import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { AgentCreate } from './pages/AgentCreate';
import { AgentPreview } from './pages/AgentPreview';
import { SkillFiles } from './pages/SkillFiles';
import { Knowledge } from './pages/Knowledge';
import { Marketplace } from './pages/Marketplace';
import { MyAgents } from './pages/MyAgents';
import { Documents } from './pages/Documents';
import { LessonPlanner } from './pages/LessonPlanner';
import { TeachingReflectionPage } from './pages/TeachingReflection';
import { ClassAnalyticsPage } from './pages/ClassAnalytics';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentCourses } from './pages/student/StudentCourses';
import { StudentChat } from './pages/student/StudentChat';
import { MistakeBook } from './pages/student/MistakeBook';
import { LearningReport } from './pages/student/LearningReport';
import { StudentSettings } from './pages/student/StudentSettings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          {/* 教师端 */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute role="teacher">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/marketplace"
            element={
              <ProtectedRoute role="teacher">
                <Marketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/my-agents"
            element={
              <ProtectedRoute role="teacher">
                <MyAgents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/agents/create"
            element={
              <ProtectedRoute role="teacher">
                <AgentCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/agents/:id/preview"
            element={
              <ProtectedRoute role="teacher">
                <AgentPreview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/skill-files"
            element={
              <ProtectedRoute role="teacher">
                <SkillFiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/knowledge"
            element={
              <ProtectedRoute role="teacher">
                <Knowledge />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/documents"
            element={
              <ProtectedRoute role="teacher">
                <Documents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/lesson-planner"
            element={
              <ProtectedRoute role="teacher">
                <LessonPlanner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/reflection"
            element={
              <ProtectedRoute role="teacher">
                <TeachingReflectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/analytics"
            element={
              <ProtectedRoute role="teacher">
                <ClassAnalyticsPage />
              </ProtectedRoute>
            }
          />
          {/* 学生端 */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/courses"
            element={
              <ProtectedRoute role="student">
                <StudentCourses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/agents/:id/chat"
            element={
              <ProtectedRoute role="student">
                <StudentChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/mistakes"
            element={
              <ProtectedRoute role="student">
                <MistakeBook />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/reports"
            element={
              <ProtectedRoute role="student">
                <LearningReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/settings"
            element={
              <ProtectedRoute role="student">
                <StudentSettings />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
