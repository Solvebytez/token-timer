"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useTokenStore } from "@/stores/token-store";

export default function Home() {
  const [tno, setTno] = useState("");
  const [quantity, setQuantity] = useState("");

  // Zustand store - using direct store access for actions to ensure reactivity
  const entries = useTokenStore((state) => state.entries);
  const activeTab = useTokenStore((state) => state.activeTab);
  const addEntry = useTokenStore((state) => state.addEntry);
  const setActiveTab = useTokenStore((state) => state.setActiveTab);
  const getTokenSummary = useTokenStore((state) => state.getTokenSummary);
  const getCounts = useTokenStore((state) => state.getCounts);

  // Handle tab change with proper store update
  const handleSetActiveTab = (tab: "history" | "myTokens") => {
    setActiveTab(tab);
  };



  // Get counts (recalculated on every render to reflect current 15-min window)
  const counts = getCounts();

  const handleRefresh = () => {
    if (tno === "" || quantity === "") return;

    const num = Number.parseInt(tno);
    const qty = Number.parseInt(quantity);

    if (num >= 0 && num <= 9 && qty > 0) {
      addEntry(num, qty);
      setTno("");
      setQuantity("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRefresh();
    }
  };

  const tokenSummary = getTokenSummary();

  // Different colors for each number (0-9)
  const numberColors = [
    "text-red-600",      // 0 - Red
    "text-blue-600",     // 1 - Blue
    "text-green-600",    // 2 - Green
    "text-yellow-600",   // 3 - Yellow
    "text-purple-600",   // 4 - Purple
    "text-pink-600",     // 5 - Pink
    "text-orange-600",   // 6 - Orange
    "text-teal-600",     // 7 - Teal
    "text-indigo-600",   // 8 - Indigo
    "text-cyan-600",     // 9 - Cyan
  ];

  return (
    <div className="min-h-screen bg-retro-beige p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-retro-dark mb-2">
            Token Tracker
          </h1>
          <p className="text-retro-dark/70">
            Track token frequency over 15 minutes
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Input and Counter */}
          <div className="lg:col-span-2">
            {/* Input Section */}
            <div className="bg-retro-cream border-4 border-retro-dark p-6 mb-8 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* TNO Input */}
                <div>
                  <label className="block text-sm font-bold text-retro-dark mb-2">
                    TNO
                  </label>
                  <input
                    type="text"
                    value={tno}
                    onChange={(e) => setTno(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="0-9"
                    maxLength={1}
                    className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-2xl text-center rounded"
                  />
                </div>

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-bold text-retro-dark mb-2">
                    QUANTITY
                  </label>
                  <input
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="0"
                    className="w-full px-4 py-3 bg-white border-3 border-retro-dark text-retro-dark font-bold text-2xl text-center rounded"
                  />
                </div>
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                className="w-full bg-retro-accent border-4 border-retro-dark text-retro-dark font-bold text-lg py-3 rounded-lg hover:bg-opacity-90 transition-all active:scale-95"
              >
                REFRESH
              </button>
            </div>

            {/* Counter Display */}
            <div className="bg-retro-dark border-4 border-retro-accent p-6 rounded-lg">
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 bg-retro-green border-3 border-retro-accent px-3 sm:px-6 py-4 rounded-lg"
                  >
                    <div className="text-2xl font-bold text-white">{i}</div>
                    <div className={`bg-white ${numberColors[i]} font-bold text-xl sm:text-2xl px-2 sm:px-4 py-2 rounded min-h-12 flex items-center justify-center w-full`}>
                      {counts[i] || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-retro-cream border-4 border-retro-dark rounded-lg h-full flex flex-col overflow-hidden">
              <div
                className="flex border-b-4 border-retro-dark"
                style={{ position: "relative", zIndex: 10 }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSetActiveTab("history");
                  }}
                  style={{
                    pointerEvents: "auto",
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 11,
                  }}
                  className={`flex-1 font-bold text-center py-3 border-r-2 border-retro-dark transition-all ${
                    activeTab === "history"
                      ? "bg-retro-accent text-retro-dark"
                      : "bg-retro-cream text-retro-dark hover:bg-opacity-80"
                  }`}
                >
                  HISTORY
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSetActiveTab("myTokens");
                  }}
                  style={{
                    pointerEvents: "auto",
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 11,
                  }}
                  className={`flex-1 font-bold text-center py-3 transition-all ${
                    activeTab === "myTokens"
                      ? "bg-retro-accent text-retro-dark"
                      : "bg-retro-cream text-retro-dark hover:bg-opacity-80"
                  }`}
                >
                  MY TOKENS
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* History Tab */}
                {activeTab === "history" && (
                  <div className="space-y-2">
                    {entries.length === 0 ? (
                      <p className="text-center text-retro-dark/60 py-8">
                        No entries yet
                      </p>
                    ) : (
                      [...entries].reverse().map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-1 bg-white border-2 border-retro-dark px-3 py-2 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-retro-dark text-lg">
                              #{entry.number}
                            </span>
                            <span className="text-retro-accent font-bold text-lg">
                              ×{entry.quantity}
                            </span>
                          </div>
                          <span className="text-xs text-retro-dark/60">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* My Tokens Tab */}
                {activeTab === "myTokens" && (
                  <div className="space-y-2">
                    {tokenSummary.length === 0 ? (
                      <p className="text-center text-retro-dark/60 py-8">
                        No tokens recorded yet
                      </p>
                    ) : (
                      tokenSummary.map((token) => (
                        <div
                          key={token.number}
                          className="flex flex-col gap-1 bg-retro-green border-3 border-retro-dark px-3 py-2 rounded"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white text-lg">
                              Token #{token.number}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm text-white">
                            <span>Entries: {token.count}</span>
                            <span>Total Qty: {token.quantity}</span>
                          </div>
                          <span className="text-xs text-white/70">
                            {new Date(token.lastTimestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
