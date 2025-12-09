"use client";

import { Suspense } from "react";
import LoginPage from "./page-content";

export default function LoginWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-retro-beige flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-retro-dark mb-4"></div>
          <p className="text-retro-dark font-bold">Loading...</p>
        </div>
      </div>
    }>
      <LoginPage />
    </Suspense>
  );
}


