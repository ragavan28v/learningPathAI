# AI Learning Pathway 🚀

An intelligent, AI-powered learning path generator that creates personalized, adaptive learning journeys using LangGraph workflows, LLM-powered planning, and interactive graph visualization.

## 📋 Project Overview

**Learning Path AI** is a full-stack web application designed to help users create personalized learning plans for any topic. Using advanced AI agents powered by LangGraph and LLMs (Llama 3 via Groq API), the application generates structured learning roadmaps with prerequisites, dependencies, and interactive visualizations.

### What is it?
- **AI Learning Pathway Generator**: An intelligent system that takes a learning topic and timeframe, then generates a comprehensive, visually-mapped learning plan
- **Interactive Graph Visualization**: Displays learning nodes as an interactive flowchart showing progression paths and prerequisites
- **Cloud-Backed Persistence**: Saves multiple learning plans to Firebase Firestore for user access across sessions
- **AI Chatbot Integration**: Interactive chat assistant powered by Groq's Llama 3 model for real-time learning guidance
- **Code Execution Environment**: Run Python code snippets directly within the learning context

---

## 🎯 Key Features

### 1. **AI-Powered Learning Plan Generation**
- Input any topic (e.g., "Python", "Web Development", "Machine Learning")
- Set custom timeframe (1-52 weeks or months)
- AI generates a structured learning plan with:
  - Individual learning nodes/topics
  - Prerequisites and dependencies
  - Logical learning progression
  - Estimated completion structure

### 2. **Interactive Graph Visualization**
- Visual flowchart showing learning path dependencies
- Nodes represent learning topics with smooth, animated styling
- Edges show prerequisite relationships between topics
- Drag-and-drop node management
- Click nodes for detailed learning information
- Real-time graph updates

### 3. **Multi-Plan Management**
- Create and manage multiple learning plans simultaneously
- Switch between different learning paths seamlessly
- Automatic cloud sync with Firebase
- Plan persistence across sessions

### 4. **AI Chat Assistant**
- Real-time conversational AI powered by Llama 3 (Groq API)
- Ask questions about your learning journey
- Get instant clarifications and guidance
- Chat history maintained during session

### 5. **Python Code Execution**
- Execute Python code snippets within the platform
- Useful for hands-on learning and practice
- Sandboxed execution with timeout protection (5-second limit)

### 6. **Node Detail View**
- Deep-dive into individual learning topics
- View detailed resources and learning materials
- Progress tracking per node
- Prerequisite checklists

### 7. **Cloud Data Persistence**
- Firebase Firestore integration for all plan storage
- Real-time synchronization
- Cross-device access
- Automatic backup of learning progress

---

## 🛠️ Technology Stack

### Frontend (79% JavaScript)
- **React 18.2.0** - Modern UI framework
- **React Router 7.7.0** - Client-side routing for multi-page navigation
- **ReactFlow 11.11.4** - Interactive graph visualization and node management
- **Ant Design (antd) 5.26.5** - Professional UI component library
- **Styled Components 6.1.19** - CSS-in-JS styling
- **Firebase 12.0.0** - Backend-as-a-service for authentication and data persistence
- **PWA Support** - Progressive Web App capabilities for offline functionality

### Backend (18% Python)
- **FastAPI** - High-performance async Python web framework
- **Uvicorn** - ASGI server for running FastAPI
- **Pydantic** - Data validation and schema management
- **LangGraph** - Workflow orchestration for AI agent execution
- **Requests** - HTTP client for external API communication
- **Python-dotenv** - Environment variable management

### AI & LLM Integration
- **Groq API** - LLM inference provider for Llama 3 8B model
- **Llama 3 8B** - Open-source LLM for chat and reasoning
- **LangGraph Workflow** - AI agent orchestration for learning plan generation
- **ChromaDB** (referenced in footer) - Vector database for semantic search and memory

### Database & Cloud
- **Firebase Firestore** - Cloud NoSQL database for plan storage
- **Firebase Auth** (implicit) - User authentication services

### Other Tools
- **Ant Design Icons** - Icon library for UI
- **Web Vitals** - Performance monitoring

---

## 📁 Project Structure
