"use client"

interface NumericKeypadProps {
  onNumber: (num: string) => void
  onClear: () => void
}

export default function NumericKeypad({ onNumber, onClear }: NumericKeypadProps) {
  const numbers = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["0"]]

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {numbers.map((row, rowIdx) => (
          <div key={rowIdx} className="contents">
            {row.map((num) => (
              <button
                key={num}
                onClick={() => onNumber(num)}
                className="bg-retro-cream border-3 border-retro-dark text-retro-dark font-bold text-lg py-3 hover:bg-retro-accent transition-colors"
              >
                {num}
              </button>
            ))}
          </div>
        ))}
      </div>

      <button
        onClick={onClear}
        className="w-full bg-retro-accent border-3 border-retro-dark text-retro-dark font-bold text-lg py-3 hover:bg-retro-cream transition-colors"
      >
        CLR
      </button>
    </div>
  )
}
