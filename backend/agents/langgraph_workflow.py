import os
import requests
from datetime import datetime
import json
import re
import ast

GROQ_API_KEY = os.getenv('GROQ_API_KEY', 'hard_coded_key')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY', 'hard_coded_key')

def call_llm(prompt, max_tokens=2048):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "You are a helpful AI learning roadmap generator."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3
    }
    response = requests.post(
        GROQ_API_URL,
        headers=headers,
        json=data,
        timeout=60
    )
    response.raise_for_status()
    content = response.json()['choices'][0]['message']['content']
    print(f"[DEBUG] LLM raw response (FULL): {content}")
    return content

def robust_json_parse(content):
    # Remove markdown code block markers if present
    content_clean = re.sub(r'```(json)?', '', content, flags=re.IGNORECASE).replace('```', '').strip()
    # Try to parse the whole array first
    try:
        plan = json.loads(content_clean)
        print(f"[INFO] LLM plan parsed successfully as a whole array with json.loads. Steps: {len(plan)}")
        return plan
    except Exception as e1:
        print(f"[WARN] json.loads failed on array: {e1}")
    # Fallback: object-by-object extraction
    obj_matches = re.findall(r'\{[^{}]*\}', content_clean, re.DOTALL)
    plan = []
    for idx, obj_str in enumerate(obj_matches):
        try:
            obj = json.loads(obj_str)
            plan.append(obj)
        except Exception:
            try:
                obj = ast.literal_eval(obj_str)
                plan.append(obj)
            except Exception as e:
                print(f"[ERROR] Could not parse object {idx+1}: {e}\n{obj_str[:200]}")
                continue
    if plan:
        print(f"[INFO] LLM plan parsed successfully with object-by-object extraction. Steps: {len(plan)}")
        return plan
    else:
        print(f"[ERROR] No valid objects parsed from LLM response. String: {content_clean[:500]}")
        raise ValueError("No valid objects parsed from LLM response.")

def extract_youtube_id(url):
    match = re.search(r'(?:v=|youtu\.be/)([\w-]{11})', url)
    return match.group(1) if match else None

def is_youtube_embeddable(video_id):
    import requests
    api_url = f'https://www.googleapis.com/youtube/v3/videos?part=status&id={video_id}&key={YOUTUBE_API_KEY}'
    try:
        resp = requests.get(api_url, timeout=10)
        resp.raise_for_status()
        items = resp.json().get('items', [])
        if not items:
            return False
        return items[0]['status'].get('embeddable', False)
    except Exception as e:
        print(f"[WARN] YouTube API error for video {video_id}: {e}")
        return False

def filter_embeddable_youtube_resources(resources):
    filtered = []
    for r in resources:
        if isinstance(r, dict) and r.get('type') == 'youtube':
            vid = extract_youtube_id(r.get('url', ''))
            if vid and is_youtube_embeddable(vid):
                filtered.append(r)
            else:
                print(f"[INFO] Skipping non-embeddable YouTube video: {r.get('url')}")
        else:
            filtered.append(r)
    return filtered

def normalize_plan_node(node, today):
    # id: string
    node_id = str(node.get('id') or node.get('day') or node.get('step') or node.get('index') or node.get('topic') or '')
    # topic: string
    topic = str(node.get('topic', ''))
    # date: string (optional, fallback to today)
    date = str(node.get('date', today))
    # prerequisites: list of strings
    prereq = node.get('prerequisites')
    if prereq is None:
        prerequisites = []
    elif isinstance(prereq, list):
        prerequisites = [str(p) for p in prereq]
    elif isinstance(prereq, str):
        prerequisites = [prereq]
    else:
        prerequisites = []
    # materials: list of strings
    mats = node.get('materials')
    if mats is None:
        materials = []
    elif isinstance(mats, list):
        materials = [str(m) for m in mats]
    elif isinstance(mats, str):
        materials = [mats]
    else:
        materials = []
    # resources: list of dicts with type/title/url
    res = node.get('resources')
    resources = []
    if isinstance(res, list):
        for r in res:
            if isinstance(r, dict) and all(k in r for k in ('type', 'title', 'url')):
                resources.append(r)
            elif isinstance(r, str):
                # Try to guess type/title from URL
                url = r
                if 'youtube' in url:
                    rtype = 'youtube'
                elif 'article' in url or 'wiki' in url:
                    rtype = 'article'
                else:
                    rtype = 'link'
                resources.append({'type': rtype, 'title': topic, 'url': url})
    # Filter YouTube resources for embeddability
    resources = filter_embeddable_youtube_resources(resources)
    # children: always empty list
    children = []
    return {
        'id': node_id,
        'topic': topic,
        'date': date,
        'prerequisites': prerequisites,
        'materials': materials,
        'resources': resources,
        'children': children
    }

def normalize_plan(plan, today):
    return [normalize_plan_node(node, today) for node in plan]

def repair_json_string(json_str):
    # Remove newlines and excessive spaces
    s = json_str.replace('\n', '').replace('\r', '').replace('  ', ' ')
    # Add missing commas between objects (naive, but helps)
    s = re.sub(r'}\s*{', '},{', s)
    # Remove trailing commas before closing array
    s = re.sub(r',\s*]', ']', s)
    # Ensure array is closed
    if not s.strip().endswith(']'):
        s += ']'
    # Ensure array is opened
    if not s.strip().startswith('['):
        s = '[' + s
    return s

def run_learning_plan_workflow(request):
    topic = getattr(request, 'topic', 'Sample Topic')
    try:
        timeframe = int(getattr(request, 'timeframe', '7'))
    except Exception:
        timeframe = 7
    if timeframe < 2:
        timeframe = 2
    today = datetime.now().date()
    try:
        # 1. Get compact schedule (topics and requirements only)
        schedule_prompt = f"""
You are an expert learning path AI. Given the topic '{topic}' and a desired study span of EXACTLY {timeframe} days, return ONLY a valid, compact, minified JSON array with EXACTLY {timeframe} objects, one for each day, numbered 1 to {timeframe}. Do NOT group days. Do NOT skip days. Each object must have a unique 'day' from 1 to {timeframe}, a 'topic', and a 'prerequisites' field (list of strings, can be empty). No resources, no explanation, no pretty-printing, no Markdown, no newlines, no extra spaces. Ensure every object and array is valid JSON with all commas and brackets closed. Follow the format in the example exactly, and do not add any extra text.
Example: [{{"day":1,"topic":"Intro to AI","prerequisites":[]}},{{"day":2,"topic":"History of AI","prerequisites":["Intro to AI"]}},{{"day":3,"topic":"AI Applications","prerequisites":["History of AI"]}},{{"day":4,"topic":"Machine Learning Basics","prerequisites":["AI Applications"]}},{{"day":5,"topic":"Neural Networks","prerequisites":["Machine Learning Basics"]}},{{"day":6,"topic":"Deep Learning","prerequisites":["Neural Networks"]}},{{"day":7,"topic":"AI Ethics","prerequisites":["Deep Learning"]}},{{"day":8,"topic":"Future of AI","prerequisites":["AI Ethics"]}}]
"""
        schedule_content = call_llm(schedule_prompt, max_tokens=2048)
        schedule = robust_json_parse(schedule_content)
        # If LLM returns fewer than requested, fill in missing days
        if len(schedule) < timeframe:
            for i in range(len(schedule)+1, timeframe+1):
                schedule.append({
                    'day': i,
                    'topic': f'{topic} - Day {i} (FILLER)',
                    'prerequisites': [schedule[-1]['topic']] if schedule else []
                })
        # 2. Batch process by week (or 5 days per batch for robustness)
        batch_size = 5
        full_plan = []
        for batch_start in range(0, len(schedule), batch_size):
            batch_days = schedule[batch_start:batch_start+batch_size]
            batch_prompt = f"""
You are an expert learning path AI. For the following days and topics, return ONLY a valid, compact, minified JSON array with for each day: 'day', 'topic', 'prerequisites' (list), 'materials' (list), and 'resources' (list of dicts with type/title/url). No explanation, no Markdown, no pretty-printing, no newlines, no extra spaces. Ensure every object and array is valid JSON with all commas and brackets closed. Follow the format in the example exactly, and do not add any extra text.
Example: [{{"day":1,"topic":"C Language Basics","prerequisites":[],"materials":["article","quiz"],"resources":[{{"type":"article","title":"C Language Basics","url":"https://en.wikipedia.org/wiki/C_(programming_language)"}}]}},{{"day":2,"topic":"Variables and Data Types","prerequisites":["C Language Basics"],"materials":["video","article"],"resources":[{{"type":"youtube","title":"Variables and Data Types","url":"https://www.youtube.com/watch?v=KJGSYHN4J3w"}}]}}]
Days: {json.dumps(batch_days)}
"""
            batch_content = call_llm(batch_prompt, max_tokens=2048)
            batch_plan = robust_json_parse(batch_content)
            full_plan.extend(batch_plan)
        normalized = normalize_plan(full_plan, today)
        print(f"[DEBUG] Normalized plan: {json.dumps(normalized, indent=2)}")
        return {'plan': normalized}
    except Exception as e:
        print(f"[LLM PLAN ERROR] {e}")
        print("[WARN] Using fallback static plan.")
        # Fallback static plan
        fallback = []
        for i in range(1, timeframe + 1):
            fallback.append({
                'id': str(i),
                'topic': f'{topic} - Step {i} (FALLBACK)',
                'date': str(today),
                'prerequisites': [str(i-1)] if i > 1 else [],
                'materials': ['video', 'article', 'quiz'] if i < timeframe else ['project', 'review'],
                'resources': [
                    {'type': 'youtube', 'title': f'{topic} Video {i}', 'url': 'https://www.youtube.com/embed/rfscVS0vtbw'},
                    {'type': 'article', 'title': f'{topic} Article {i}', 'url': 'https://www.geeksforgeeks.org/python-programming-language/'}
                ],
                'children': []
            })
        return {'plan': normalize_plan(fallback, today)} 