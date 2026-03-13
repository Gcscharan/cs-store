import { calculateHaversineDistance } from '../utils/routeUtils'

const WAREHOUSE = { lat: 17.094, lng: 80.598 }
const FUEL_EFFICIENCY = 20  // km/litre
const FUEL_COST = 90        // ₹/litre
const AVG_SPEED_KMH = 30
const STOP_TIME_MIN = 5

// ============================================================
// SCENARIO: 20 orders in Vijayawada cluster + 1 outlier
// 19 orders: tight cluster around Vijayawada (within 8km)
// 1 outlier: Kurnool (170km away from cluster)
// ============================================================

const CLUSTER_CENTER = { lat: 16.5062, lng: 80.6480 } // Vijayawada

// Generate 19 tight orders around Vijayawada
const normalOrders = Array.from({ length: 19 }, (_, i) => {
  const latOffset = (Math.random() - 0.5) * 0.14  // ~8km radius
  const lngOffset = (Math.random() - 0.5) * 0.14
  return {
    id: `order_${i + 1}`,
    city: 'Vijayawada',
    address: {
      lat: parseFloat((CLUSTER_CENTER.lat + latOffset).toFixed(6)),
      lng: parseFloat((CLUSTER_CENTER.lng + lngOffset).toFixed(6)),
    }
  }
})

// The 1 outlier order (Kurnool - 170km from Vijayawada)
const outlierOrder = {
  id: 'order_outlier',
  city: 'Kurnool',
  address: { lat: 15.8281, lng: 78.0373 }
}

const allOrders = [...normalOrders, outlierOrder]

// ============================================================
// CALCULATE: Current system (outlier stays IN cluster)
// ============================================================
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
  const fuelLitres = distKm / FUEL_EFFICIENCY

  console.log(`\n📦 ${label}`)
  console.log(`   Orders:        ${orders.length}`)
  console.log(`   Distance:      ${distKm.toFixed(1)} km`)
  console.log(`   Drive Time:    ${driveMin.toFixed(0)} min`)
  console.log(`   Stop Time:     ${stopMin} min`)
  console.log(`   Total Time:    ${totalHrs.toFixed(1)} hours`)
  console.log(`   Fuel:          ${fuelLitres.toFixed(1)} litres`)
  console.log(`   Fuel Cost:     ₹${fuelCost.toFixed(0)}`)
  return { distKm, totalHrs, fuelCost }
}

// ============================================================
// DETECT OUTLIER FUNCTION (what we need to build)
// ============================================================
function detectOutliers(orders: any[], threshold: number = 2.5): {
  normal: any[],
  outliers: any[],
  report: any[]
} {
  // Step 1: Calculate centroid of all orders
  const centroid = {
    lat: orders.reduce((s, o) => s + o.address.lat, 0) / orders.length,
    lng: orders.reduce((s, o) => s + o.address.lng, 0) / orders.length,
  }

  // Step 2: Calculate each order's distance from centroid
  const withDistances = orders.map(order => ({
    ...order,
    distFromCentroid: calculateHaversineDistance(centroid, order.address)
  }))

  // Step 3: Calculate mean and std deviation
  const mean = withDistances.reduce((s, o) => s + o.distFromCentroid, 0) / orders.length
  const variance = withDistances.reduce((s, o) => 
    s + Math.pow(o.distFromCentroid - mean, 2), 0) / orders.length
  const stdDev = Math.sqrt(variance)

  // Step 4: Flag orders beyond threshold standard deviations
  const normal: any[] = []
  const outliers: any[] = []
  const report: any[] = []

  for (const order of withDistances) {
    const zScore = stdDev > 0 ? (order.distFromCentroid - mean) / stdDev : 0
    const isOutlier = zScore > threshold

    report.push({
      id: order.id,
      city: order.city,
      distFromCentroid: order.distFromCentroid,
      zScore,
      isOutlier
    })

    if (isOutlier) outliers.push(order)
    else normal.push(order)
  }

  console.log(`\n🔍 OUTLIER DETECTION REPORT:`)
  console.log(`   Centroid: lat ${centroid.lat.toFixed(4)}, lng ${centroid.lng.toFixed(4)}`)
  console.log(`   Mean distance from centroid: ${mean.toFixed(1)} km`)
  console.log(`   Std deviation: ${stdDev.toFixed(1)} km`)
  console.log(`   Threshold: ${threshold} std deviations`)
  console.log(`\n   Order Analysis:`)
  report.sort((a, b) => b.distFromCentroid - a.distFromCentroid)
  report.forEach(r => {
    const flag = r.isOutlier ? '🚨 OUTLIER' : '✅ normal'
    console.log(
      `   ${flag}  ${r.id.padEnd(16)} ` +
      `${r.city.padEnd(18)} ` +
      `${r.distFromCentroid.toFixed(1).padStart(7)} km from centroid  ` +
      `z=${r.zScore.toFixed(2)}` 
    )
  })

  return { normal, outliers, report }
}

// ============================================================
// COST OF OUTLIER CALCULATION
// ============================================================
function calculateOutlierCost(
  normalOrders: any[],
  outlierOrders: any[],
  depot: any
) {
  // Cost WITH outlier in same route
  const withOutlierDist = calculateRouteDistance([...normalOrders, ...outlierOrders], depot)
  const withOutlierFuel = (withOutlierDist / FUEL_EFFICIENCY) * FUEL_COST

  // Cost WITHOUT outlier (normal route only)
  const normalOnlyDist = calculateRouteDistance(normalOrders, depot)
  const normalOnlyFuel = (normalOnlyDist / FUEL_EFFICIENCY) * FUEL_COST

  // Cost of mini-route for outlier alone
  const miniRouteDist = calculateHaversineDistance(depot, outlierOrders[0].address) * 2
  const miniRouteFuel = (miniRouteDist / FUEL_EFFICIENCY) * FUEL_COST

  // Total cost comparison
  const combinedCost = withOutlierFuel
  const separatedCost = normalOnlyFuel + miniRouteFuel
  const outlierPenalty = withOutlierFuel - normalOnlyFuel

  console.log(`\n💰 OUTLIER COST ANALYSIS:`)
  console.log(`   ─────────────────────────────────────────`)
  console.log(`   SCENARIO A: Keep outlier in same cluster`)
  console.log(`   Total distance:  ${withOutlierDist.toFixed(1)} km`)
  console.log(`   Total fuel cost: ₹${withOutlierFuel.toFixed(0)}`)
  console.log(`   ─────────────────────────────────────────`)
  console.log(`   SCENARIO B: Separate into mini-route`)
  console.log(`   Normal route:    ${normalOnlyDist.toFixed(1)} km  ₹${normalOnlyFuel.toFixed(0)}`)
  console.log(`   Mini-route:      ${miniRouteDist.toFixed(1)} km  ₹${miniRouteFuel.toFixed(0)}`)
  console.log(`   Total combined:  ₹${separatedCost.toFixed(0)}`)
  console.log(`   ─────────────────────────────────────────`)
  console.log(`   💸 Outlier penalty (extra cost to cluster): ₹${outlierPenalty.toFixed(0)}`)
  console.log(`   💡 Saving by separating:  ₹${(combinedCost - separatedCost).toFixed(0)}`)

  const savingPercent = ((combinedCost - separatedCost) / combinedCost) * 100
  if (combinedCost > separatedCost) {
    console.log(`   ✅ SEPARATE IS BETTER by ${savingPercent.toFixed(1)}%`)
  } else {
    console.log(`   ⚠️  KEEPING TOGETHER IS ACTUALLY CHEAPER`)
  }

  return { outlierPenalty, savingBySeparating: combinedCost - separatedCost }
}

// ============================================================
// RUN THE TEST
// ============================================================
console.log('='.repeat(60))
console.log('OUTLIER ORDER TEST')
console.log('19 orders in Vijayawada + 1 outlier in Kurnool (170km)')
console.log('='.repeat(60))

console.log(`\n📍 Order Distribution:`)
console.log(`   19 normal orders: Vijayawada area (within 8km of city center)`)
console.log(`   1 outlier order:  Kurnool (170km from Vijayawada)`)

const distToOutlier = calculateHaversineDistance(CLUSTER_CENTER, outlierOrder.address)
console.log(`\n   Distance Vijayawada → Kurnool: ${distToOutlier.toFixed(1)} km`)

// Current behavior (outlier in cluster)
console.log(`\n${'─'.repeat(60)}`)
console.log(`CURRENT SYSTEM BEHAVIOR (outlier included in cluster):`)
routeMetrics(allOrders, WAREHOUSE, 'All 20 orders including outlier')

// What it should be
console.log(`\n${'─'.repeat(60)}`)
console.log(`OPTIMAL BEHAVIOR (outlier separated):`)
routeMetrics(normalOrders, WAREHOUSE, '19 normal orders only')
routeMetrics([outlierOrder], WAREHOUSE, '1 outlier as mini-route')

// Outlier detection
console.log(`\n${'─'.repeat(60)}`)
const { normal, outliers } = detectOutliers(allOrders)
console.log(`\n   Result: ${outliers.length} outlier(s) detected, ${normal.length} normal orders`)

// Cost analysis
console.log(`\n${'─'.repeat(60)}`)
calculateOutlierCost(normalOrders, [outlierOrder], WAREHOUSE)

console.log('\n' + '='.repeat(60))
console.log('END OF OUTLIER TEST')
console.log('='.repeat(60))
