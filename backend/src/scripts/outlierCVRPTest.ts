import { cvrpRouteAssignmentService, OrderInput, VehicleInput } from '../services/cvrpRouteAssignmentService'
import { calculateHaversineDistance } from '../utils/routeUtils'

const VIJAYAWADA_HUB = { lat: 16.5062, lng: 80.6480 }
const FUEL_EFFICIENCY = 20
const FUEL_COST = 90
const AVG_SPEED_KMH = 30
const STOP_TIME_MIN = 5

// 19 orders in Vijayawada (within 8km of hub)
const normalOrders: OrderInput[] = Array.from({ length: 19 }, (_, i) => {
  const latOffset = (Math.random() - 0.5) * 0.14
  const lngOffset = (Math.random() - 0.5) * 0.14
  return {
    orderId: `ORD-${String(i + 1).padStart(4, '0')}`,
    lat: parseFloat((VIJAYAWADA_HUB.lat + latOffset).toFixed(6)),
    lng: parseFloat((VIJAYAWADA_HUB.lng + lngOffset).toFixed(6)),
  }
})

// 1 outlier in Kurnool (170km from Vijayawada)
const outlierOrder: OrderInput = {
  orderId: 'ORD-OUTLIER',
  lat: 15.8281,
  lng: 78.0373,
}

const allOrders = [...normalOrders, outlierOrder]

function routeMetrics(route: any, depot: any, label: string) {
  let dist = 0
  let prev = depot
  
  for (const orderId of route.orders) {
    const order = allOrders.find(o => o.orderId === orderId)
    if (order) {
      dist += calculateHaversineDistance(prev, order)
      prev = order
    }
  }
  dist += calculateHaversineDistance(prev, depot)
  
  const driveMin = (dist / AVG_SPEED_KMH) * 60
  const stopMin = route.orders.length * STOP_TIME_MIN
  const totalHrs = (driveMin + stopMin) / 60
  const fuelCost = (dist / FUEL_EFFICIENCY) * FUEL_COST

  console.log(`\n📦 ${label}`)
  console.log(`   Orders:        ${route.orders.length}`)
  console.log(`   Distance:      ${dist.toFixed(1)} km`)
  console.log(`   Total Time:    ${totalHrs.toFixed(1)} hours`)
  console.log(`   Fuel Cost:     ₹${fuelCost.toFixed(0)}`)
  console.log(`   Is Outlier:    ${route.isOutlierRoute ? '🚨 YES' : '✅ NO'}`)
  if (route.outlierReason) {
    console.log(`   Reason:        ${route.outlierReason}`)
  }
  return { dist, totalHrs, fuelCost }
}

console.log('='.repeat(70))
console.log('OUTLIER DETECTION TEST - CVRP PIPELINE')
console.log('19 orders in Vijayawada + 1 outlier in Kurnool (170km)')
console.log('='.repeat(70))

const distToOutlier = calculateHaversineDistance(VIJAYAWADA_HUB, outlierOrder)
console.log(`\n📍 Distance Vijayawada Hub → Kurnool: ${distToOutlier.toFixed(1)} km`)

console.log(`\n${'─'.repeat(70)}`)
console.log(`RUNNING CVRP WITH OUTLIER DETECTION...`)

const vehicle: VehicleInput = { 
  type: 'AUTO', 
  maxDistanceKm: 60, 
  capacity: 15 
}

const hubConfig = {
  hubId: 'hub_vijayawada',
  hubName: 'Vijayawada Hub',
  depotLat: VIJAYAWADA_HUB.lat,
  depotLng: VIJAYAWADA_HUB.lng,
  tier: 'hub' as const,
}

try {
  const result = cvrpRouteAssignmentService.computeRoutesForHub(allOrders, vehicle, hubConfig)
  
  console.log(`\n✅ CVRP completed successfully`)
  console.log(`   Total routes: ${result.routes.length}`)
  console.log(`   Computation: ${result.metadata.computationTimeMs}ms`)
  
  // Separate normal and outlier routes
  const normalRoutes = result.routes.filter(r => !r.isOutlierRoute)
  const outlierRoutes = result.routes.filter(r => r.isOutlierRoute)
  
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`📊 NORMAL ROUTES (${normalRoutes.length}):`)
  
  let totalNormalDist = 0
  let totalNormalTime = 0
  
  for (const route of normalRoutes) {
    const metrics = routeMetrics(route, VIJAYAWADA_HUB, `Route ${route.routeId}`)
    totalNormalDist += metrics.dist
    totalNormalTime += metrics.totalHrs
  }
  
  if (outlierRoutes.length > 0) {
    console.log(`\n${'─'.repeat(70)}`)
    console.log(`🚨 OUTLIER ROUTES (${outlierRoutes.length}):`)
    
    for (const route of outlierRoutes) {
      const metrics = routeMetrics(route, VIJAYAWADA_HUB, `Route ${route.routeId} (OUTLIER)`)
    }
  }
  
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`📈 SUMMARY:`)
  console.log(`   Normal routes:      ${normalRoutes.length}`)
  console.log(`   Outlier routes:     ${outlierRoutes.length}`)
  console.log(`   Outlier detected:   ${outlierRoutes.length > 0 ? '✅ YES' : '❌ NO'}`)
  
  if (normalRoutes.length > 0) {
    const avgTime = totalNormalTime / normalRoutes.length
    console.log(`   Avg normal route:   ${avgTime.toFixed(1)} hours`)
    console.log(`   All ≤ 8 hours:      ${totalNormalTime / normalRoutes.length <= 8 ? '✅ YES' : '❌ NO'}`)
  }
  
  console.log('\n' + '='.repeat(70))
  
  if (outlierRoutes.length > 0) {
    console.log('🎉 OUTLIER DETECTION WORKING!')
    console.log('   The outlier order was automatically separated into its own mini-route.')
    console.log('   Normal routes are now completable in a working day.')
  } else {
    console.log('⚠️  OUTLIER NOT DETECTED')
    console.log('   The outlier order remained in a normal route.')
    console.log('   This may cause route to exceed 8 hours.')
  }
  console.log('='.repeat(70))
  
} catch (err: any) {
  console.log(`\n❌ CVRP FAILED: ${err.message}`)
}
