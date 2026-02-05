import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed, isLoading } = useAuth();
  if (isLoading) return null; // or a loading spinner
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthed, isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/shop" replace />;
  return <>{children}</>;
}
