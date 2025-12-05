"use client"

const products = [
  { id: 1, name: "Item A", price: 12.99 },
  { id: 2, name: "Item B", price: 24.5 },
  { id: 3, name: "Item C", price: 8.99 },
  { id: 4, name: "Item D", price: 15.75 },
  { id: 5, name: "Item E", price: 19.99 },
  { id: 6, name: "Item F", price: 11.5 },
  { id: 7, name: "Item G", price: 22.0 },
  { id: 8, name: "Item H", price: 9.99 },
  { id: 9, name: "Item I", price: 16.25 },
  { id: 10, name: "Item J", price: 13.75 },
  { id: 11, name: "Item K", price: 18.5 },
  { id: 12, name: "Item L", price: 21.99 },
]

export default function ProductGrid() {
  return (
    <div>
      <h2 className="text-xl font-bold text-retro-dark mb-4">PRODUCTS</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-retro-dark p-4 rounded-lg">
        {products.map((product) => (
          <button
            key={product.id}
            className="bg-retro-cream border-2 border-retro-dark text-retro-dark p-3 text-center hover:bg-retro-accent transition-colors group"
          >
            <div className="font-mono text-sm font-bold group-hover:font-bold">{product.name}</div>
            <div className="font-mono text-xs text-retro-dark/70 group-hover:text-retro-dark">
              ${product.price.toFixed(2)}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
