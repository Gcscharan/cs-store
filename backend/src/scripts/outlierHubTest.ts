import { calculateHaversineDistance } from '../utils/routeUtils'

const VIJAYAWADA_HUB = { lat: 16.5062, lng: 80.6480 }
const FUEL_EFFICIENCY = 20
const FUEL_COST = 90
const AVG_SPEED_KMH = 30
const STOP_TIME_MIN = 5

// 19 orders in Vijayawada (within 8km of hub)
const normalOrders = Array.from({ length: 19 }, (_, i) => {
  const latOffset = (Math.random() - 0.5) * 0.14
  const lngOffset = (Math.random() - 0.5) * 0.14
  return {
    id: `order_${i + 1}`,
    city: 'Vijayawada',
    address: {
      lat: parseFloat((VIJAYAWADA_HUB.lat + latOffset).toFixed(6)),
      lng: parseFloat((VIJAYAWADA_HUB.lng + lngOffset).toFixed(6)),
    }
  }
})

// 1 outlier in Kurnool (170km from Vijayawada)
const outlierOrder = {
  id: 'order_outlier',
  city: 'Kurnool',
  address: { lat: 15.8281, lng: 78.0373 }
}

const allOrders = [...normalOrders, outlierOrder]

function calculateRouteDistance(orders: any[], depot: any): number {
  let total = 0
  let prev = depot
  for (const order of orders) {
    total += calculateHaversineDistance(prev, order.address)
    prev = order.address
  }
  total += calculateHaversineDistance(prev, depot)
  return total
}

function routeMetrics(orders: any[], depot: any, label: string) {
  const distKm = calculateRouteDistance(orders, depot)
  const driveMin = (distKm / AVG_SPEED_KMH) * 60
  const stopMin = orders.length * STOP_TIME_MIN
  const totalHrs = (driveMin + stopMin) / 60
  const fuelCost = (distKm / FUEL_EFFICIENCY) * FUEL_COST

  console.log(`\n📦 ${label}`)
  console.log(`   Orders:        ${orders.length}`)
  console.log(`   Distance:      ${distKm.toFixed(1)} km`)
  console.log(`   Total Time:    ${totalHrs.toFixed(1)} hours`)
  console.log(`   Fuel Cost:     ₹${fuelCost.toFixed(0)}`)
  return { distKm, totalHrs, fuelCost }
}

console.log('='.repeat(60))
console.log('OUTLIER TEST - FROM VIJAYAWADA HUB')
console.log('='.repeat(60))

const distToOutlier = calculateHaversineDistance(VIJAYAWADA_HUB, outlierOrder.address)
console.log(`\n📍 Distance Vijayawada Hub → Kurnool: ${distToOutlier.toFixed(1)} km`)

console.log(`\n${'─'.repeat(60)}`)
console.log(`SCENARIO A: Outlier included in cluster route:`)
const withOutlier = routeMetrics(allOrders, VIJAYAWADA_HUB, 'All 20 orders')

console.log(`\n${'─'.repeat(60)}`)
console.log(`SCENARIO B: Outlier separated into mini-route:`)
const normal = routeMetrics(normalOrders, VIJAYAWADA_HUB, '19 normal orders')
const mini = routeMetrics([outlierOrder], VIJAYAWADA_HUB, '1 outlier mini-route')

console.log(`\n${'─'.repeat(60)}`)
console.log(`💰 COST COMPARISON:`)
console.log(`   Scenario A (together):  ₹${withOutlier.fuelCost.toFixed(0)}`)
console.log(`   Scenario B (separated): ₹${(normal.fuelCost + mini.fuelCost).toFixed(0)}`)
console.log(`   Difference:            ₹${(withOutlier.fuelCost - normal.fuelCost - mini.fuelCost).toFixed(0)}`)

if (withOutlier.fuelCost > normal.fuelCost + mini.fuelCost) {
  console.log(`   ✅ SEPARATE IS BETTER`)
} else {
  console.log(`   ⚠️  KEEPING TOGETHER IS CHEAPER`)
}

console.log(`\n${'─'.repeat(60)}`)
console.log(`⏱️  TIME IMPACT:`)
console.log(`   With outlier:    ${withOutlier.totalHrs.toFixed(1)} hours`)
console.log(`   Normal route:    ${normal.totalHrs.toFixed(1)} hours`)
console.log(`   Outlier adds:    ${(withOutlier.totalHrs - normal.totalHrs).toFixed(1)} hours to route`)

console.log('\n' + '='.repeat(60))
