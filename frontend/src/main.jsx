import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LocationProvider } from './context/LocationContext'

import App from './App'
import AnalyzePage from './pages/AnalyzePage'
import TrailsPage from './pages/TrailsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import HistoryPage from './pages/HistoryPage'
import CommunityPage from './pages/CommunityPage'
import CouponsPage from './pages/CouponsPage'
import ProtectedRoute from './components/ProtectedRoute'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/analyze', element: <AnalyzePage /> },
  { path: '/trails', element: <TrailsPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { 
    path: '/profile', 
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ) 
  },
  { 
    path: '/history', 
    element: (
      <ProtectedRoute>
        <HistoryPage />
      </ProtectedRoute>
    ) 
  },
  { 
    path: '/community', 
    element: (
      <ProtectedRoute>
        <CommunityPage />
      </ProtectedRoute>
    ) 
  },
  { 
    path: '/coupons', 
    element: (
      <ProtectedRoute>
        <CouponsPage />
      </ProtectedRoute>
    ) 
  },
])

const root = createRoot(document.getElementById('root'))
root.render(
  <AuthProvider>
    <LocationProvider>
      <RouterProvider router={router} />
    </LocationProvider>
  </AuthProvider>
)