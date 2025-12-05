interface CalculatorDisplayProps {
  value: string
}

export default function CalculatorDisplay({ value }: CalculatorDisplayProps) {
  return (
    <div className="bg-retro-dark border-4 border-retro-dark rounded-lg p-6">
      <div className="text-right text-4xl font-mono text-retro-accent font-bold tracking-wider">{value}</div>
    </div>
  )
}
