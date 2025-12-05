"use client"

interface OperationPanelProps {
  onOperation: (op: string) => void
}

export default function OperationPanel({ onOperation }: OperationPanelProps) {
  const operations = [
    { label: "+", value: "add" },
    { label: "-", value: "subtract" },
    { label: "=", value: "equals" },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {operations.map((op) => (
        <button
          key={op.value}
          onClick={() => onOperation(op.value)}
          className={`border-3 font-bold text-lg py-4 transition-colors ${
            op.value === "equals"
              ? "bg-retro-green border-retro-dark text-retro-dark hover:bg-opacity-80"
              : "bg-retro-accent border-retro-dark text-retro-dark hover:bg-opacity-80"
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  )
}
