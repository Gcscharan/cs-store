import mongoose from 'mongoose'
import { cvrpRouteAssignmentService, OrderInput, VehicleInput, Route } from '../services/cvrpRouteAssignmentService'
import { calculateHaversineDistance } from '../utils/routeUtils'
import { 
  loadHubs, 
  HUBS, 
  assignOrderToHub, 
  groupOrdersByHub, 
  getHubById, 
  getWarehouseCoords,
  DeliveryHub 
} from '../services/hubAssignmentService'

// ============================================================
// AP & TELANGANA REAL LOCATIONS (lat/lng bounds)
// AP:        lat 12.6 - 19.9,  lng 76.8 - 84.6
// Telangana: lat 15.8 - 19.9,  lng 77.2 - 81.3
// Warehouse: lat 17.094, lng 80.598 (Tiruvuru, Krishna Dist)
// ============================================================

const AP_CITIES = [
  // Krishna District (close to warehouse)
  { name: 'Vijayawada',     lat: 16.5062, lng: 80.6480, weight: 8 },
  { name: 'Machilipatnam',  lat: 16.1875, lng: 81.1389, weight: 4 },
  { name: 'Gudivada',       lat: 16.4344, lng: 80.9947, weight: 3 },
  { name: 'Nuzvid',         lat: 16.7897, lng: 80.8489, weight: 3 },
  { name: 'Tiruvuru',       lat: 17.0940, lng: 80.5980, weight: 2 },
  // Guntur District
  { name: 'Guntur',         lat: 16.3067, lng: 80.4365, weight: 6 },
  { name: 'Tenali',         lat: 16.2427, lng: 80.6407, weight: 3 },
  { name: 'Narasaraopet',   lat: 16.2345, lng: 80.0490, weight: 2 },
  // West Godavari
  { name: 'Eluru',          lat: 16.7107, lng: 81.0952, weight: 4 },
  { name: 'Bhimavaram',     lat: 16.5440, lng: 81.5212, weight: 3 },
  // East Godavari
  { name: 'Rajahmundry',    lat: 17.0005, lng: 81.8040, weight: 4 },
  { name: 'Kakinada',       lat: 16.9891, lng: 82.2475, weight: 3 },
  // Nellore
  { name: 'Nellore',        lat: 14.4426, lng: 79.9865, weight: 3 },
  // Kurnool
  { name: 'Kurnool',        lat: 15.8281, lng: 78.0373, weight: 3 },
  // Visakhapatnam
  { name: 'Visakhapatnam',  lat: 17.6868, lng: 83.2185, weight: 4 },
  // Chittoor
  { name: 'Tirupati',       lat: 13.6288, lng: 79.4192, weight: 3 },
  // Prakasam
  { name: 'Ongole',         lat: 15.5057, lng: 80.0499, weight: 2 },
  // Anantapur
  { name: 'Anantapur',      lat: 14.6819, lng: 77.6006, weight: 2 },
]

const TELANGANA_CITIES = [
  // Hyderabad metro (highest density)
  { name: 'Hyderabad',      lat: 17.3850, lng: 78.4867, weight: 10 },
  { name: 'Secunderabad',   lat: 17.4399, lng: 78.4983, weight: 5 },
  { name: 'Kukatpally',     lat: 17.4849, lng: 78.4138, weight: 4 },
  { name: 'LB Nagar',       lat: 17.3480, lng: 78.5510, weight: 3 },
  { name: 'Uppal',          lat: 17.4060, lng: 78.5590, weight: 3 },
  // Rangareddy
  { name: 'Shamshabad',     lat: 17.2543, lng: 78.4291, weight: 2 },
  // Warangal
  { name: 'Warangal',       lat: 17.9784, lng: 79.5941, weight: 4 },
  { name: 'Hanamkonda',     lat: 17.9975, lng: 79.5631, weight: 2 },
  // Nizamabad
  { name: 'Nizamabad',      lat: 18.6725, lng: 78.0942, weight: 3 },
  // Karimnagar
  { name: 'Karimnagar',     lat: 18.4386, lng: 79.1288, weight: 3 },
  // Khammam
  { name: 'Khammam',        lat: 17.2473, lng: 80.1514, weight: 3 },
  // Nalgonda
  { name: 'Nalgonda',       lat: 17.0575, lng: 79.2670, weight: 2 },
  // Mahbubnagar
  { name: 'Mahbubnagar',    lat: 16.7373, lng: 77.9874, weight: 2 },
  // Adilabad
  { name: 'Adilabad',       lat: 19.6641, lng: 78.5320, weight: 2 },
  // Medak
  { name: 'Sangareddy',     lat: 17.6189, lng: 78.0859, weight: 2 },
]

const ALL_CITIES = [...AP_CITIES, ...TELANGANA_CITIES]
const TOTAL_WEIGHT = ALL_CITIES.reduce((s, c) => s + c.weight, 0)

// Warehouse
const WAREHOUSE = getWarehouseCoords()

interface TestOrder {
  _id: string
  orderId: string
  city: string
  region: string
  address: {
    lat: number
    lng: number
    city: string
    state: string
    pincode?: string
  }
  status: string
  amount: number
  hubAssignment?: {
    hubId: string
    hubName: string
    tier: 'local' | 'hub'
    depotLat: number
    depotLng: number
    distanceFromDepot: number
  }
}

// Generate weighted random orders
function generateOrders(count: number): TestOrder[] {
  const orders: TestOrder[] = []
  
  for (let i = 0; i < count; i++) {
    // Pick city by weight
    let rand = Math.random() * TOTAL_WEIGHT
    let city = ALL_CITIES[ALL_CITIES.length - 1]
    for (const c of ALL_CITIES) {
      rand -= c.weight
      if (rand <= 0) { city = c; break }
    }
    
    // Add random offset within ~10km radius of city center
    const latOffset = (Math.random() - 0.5) * 0.18  // ~10km
    const lngOffset = (Math.random() - 0.5) * 0.18
    
    orders.push({
      _id: `test_order_${i + 1}`,
      orderId: `ORD-DEBUG-${String(i + 1).padStart(4, '0')}`,
      city: city.name,
      region: AP_CITIES.includes(city) ? 'AP' : 'Telangana',
      address: {
        lat: parseFloat((city.lat + latOffset).toFixed(6)),
        lng: parseFloat((city.lng + lngOffset).toFixed(6)),
        city: city.name,
        state: AP_CITIES.includes(city) ? 'Andhra Pradesh' : 'Telangana',
      },
      status: 'PACKED',
      amount: Math.floor(Math.random() * 2000) + 100,
    })
  }
  return orders
}

// ============================================================
// NAIVE ROUTING: every order gets individual trip from depot
// ============================================================
function calculateNaiveDistance(orders: TestOrder[], depotLat: number, depotLng: number): number {
  return orders.reduce((total, order) => {
    const toOrder = calculateHaversineDistance({ lat: depotLat, lng: depotLng }, order.address)
    const backToDepot = calculateHaversineDistance(order.address, { lat: depotLat, lng: depotLng })
    return total + toOrder + backToDepot
  }, 0)
}

// ============================================================
// CLUSTERED ROUTING: depot → all stops in route → depot
// ============================================================
function calculateRouteDistance(route: Route, orderMap: Map<string, TestOrder>): number {
  if (!route.orders || route.orders.length === 0) return 0
  
  let routeDistance = 0
  let prev = { lat: route.depotLat, lng: route.depotLng }
  
  for (const orderId of route.orders) {
    const order = orderMap.get(orderId)
    if (order) {
      routeDistance += calculateHaversineDistance(prev, order.address)
      prev = order.address
    }
  }
  // Return to depot
  routeDistance += calculateHaversineDistance(prev, { lat: route.depotLat, lng: route.depotLng })
  
  return routeDistance
}

// ============================================================
// MAIN SIMULATION
// ============================================================
async function runSimulation() {
  console.log('='.repeat(70))
  console.log('VYAPARA SETU - HUB & SPOKE DELIVERY SIMULATION')
  console.log('Warehouse: Tiruvuru, Krishna District, AP')
  console.log(`Date: ${new Date().toISOString()}`)
  console.log('='.repeat(70))
  
  // Show configured hubs
  console.log(`\n🏭 CONFIGURED DELIVERY HUBS:`)
  if (HUBS.length === 0) {
    console.log(`   ⚠️  No hubs configured in DELIVERY_HUBS env variable`)
    console.log(`   Using fallback: all orders assigned to warehouse`)
  } else {
    HUBS.forEach((hub, i) => {
      console.log(`   ${i + 1}. ${hub.name} (${hub.lat}, ${hub.lng}) - Radius: ${hub.radiusKm}km`)
    })
  }
  
  // Generate 500 test orders
  const ORDER_COUNT = 500
  console.log(`\n📦 Generating ${ORDER_COUNT} test orders across AP & Telangana...`)
  const orders = generateOrders(ORDER_COUNT)
  
  // Create order map for quick lookup
  const orderMap = new Map<string, TestOrder>()
  orders.forEach(o => orderMap.set(o.orderId, o))
  
  // Show regional distribution
  const apOrders = orders.filter(o => o.region === 'AP')
  const tsOrders = orders.filter(o => o.region === 'Telangana')
  console.log(`\n📍 Regional Distribution:`)
  console.log(`   Andhra Pradesh:  ${apOrders.length} orders (${((apOrders.length/ORDER_COUNT)*100).toFixed(1)}%)`)
  console.log(`   Telangana:       ${tsOrders.length} orders (${((tsOrders.length/ORDER_COUNT)*100).toFixed(1)}%)`)
  
  // Show city distribution (top 10)
  const cityCount: Record<string, number> = {}
  orders.forEach(o => { cityCount[o.city] = (cityCount[o.city] || 0) + 1 })
  const topCities = Object.entries(cityCount).sort((a,b) => b[1]-a[1]).slice(0, 10)
  console.log(`\n🏙️  Top 10 Cities by Order Count:`)
  topCities.forEach(([city, count], i) => {
    const bar = '█'.repeat(Math.floor(count / 5))
    console.log(`   ${String(i+1).padStart(2)}. ${city.padEnd(18)} ${String(count).padStart(3)} orders  ${bar}`)
  })
  
  // Distance from warehouse distribution
  const distances = orders.map(o => calculateHaversineDistance(WAREHOUSE, o.address))
  const avgDist = distances.reduce((a,b) => a+b, 0) / distances.length
  const under20 = distances.filter(d => d <= 20).length
  const under50 = distances.filter(d => d <= 50).length
  const under100 = distances.filter(d => d <= 100).length
  const over100 = distances.filter(d => d > 100).length
  
  console.log(`\n📏 Distance from Warehouse Distribution:`)
  console.log(`   ≤ 20 km:   ${under20} orders  (${((under20/ORDER_COUNT)*100).toFixed(1)}%)`)
  console.log(`   21-50 km:  ${under50 - under20} orders  (${(((under50-under20)/ORDER_COUNT)*100).toFixed(1)}%)`)
  console.log(`   51-100 km: ${under100 - under50} orders  (${(((under100-under50)/ORDER_COUNT)*100).toFixed(1)}%)`)
  console.log(`   > 100 km:  ${over100} orders  (${((over100/ORDER_COUNT)*100).toFixed(1)}%)`)
  console.log(`   Average distance from warehouse: ${avgDist.toFixed(1)} km`)
  
  // ============================================================
  // HUB ASSIGNMENT
  // ============================================================
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🏭 HUB ASSIGNMENT`)
  console.log(`${'='.repeat(70)}`)
  
  const hubGroups = groupOrdersByHub(orders)
  
  console.log(`\n   Orders assigned to each hub:`)
  const hubStats: { hubId: string; hubName: string; orderCount: number; routes: Route[]; depotLat: number; depotLng: number }[] = []
  
  for (const [hubId, hubOrders] of hubGroups) {
    const hub = getHubById(hubId)
    const hubName = hub?.name || 'Unknown Hub'
    const depotLat = hub?.lat || WAREHOUSE.lat
    const depotLng = hub?.lng || WAREHOUSE.lng
    
    console.log(`   ${hubName.padEnd(25)} ${String(hubOrders.length).padStart(3)} orders`)
    
    hubStats.push({
      hubId,
      hubName,
      orderCount: hubOrders.length,
      routes: [],
      depotLat,
      depotLng,
    })
  }
  
  // ============================================================
  // RUN CVRP PER HUB
  // ============================================================
  console.log(`\n${'='.repeat(70)}`)
  console.log(`⚙️  RUNNING CVRP CLUSTERING PER HUB`)
  console.log(`${'='.repeat(70)}`)
  
  const clusterStartTime = Date.now()
  let totalCVRPRoutes = 0
  let cvrpSuccessCount = 0
  let cvrpFailCount = 0
  
  const MAX_DISTANCE_KM = parseInt(process.env.ROUTE_MAX_DISTANCE_KM || '60')
  const CAPACITY_MIN = parseInt(process.env.ROUTE_CAPACITY_MIN || '15')
  const CAPACITY_MAX = parseInt(process.env.ROUTE_CAPACITY_MAX || '25')
  
  console.log(`\n   Config: MAX_DISTANCE=${MAX_DISTANCE_KM}km, CAPACITY=${CAPACITY_MIN}-${CAPACITY_MAX} orders`)
  
  for (const hubInfo of hubStats) {
    const hubOrders = hubGroups.get(hubInfo.hubId) || []
    
    if (hubOrders.length === 0) continue
    
    console.log(`\n   📍 Processing ${hubInfo.hubName} (${hubOrders.length} orders)...`)
    
    // Transform to CVRP input
    const orderInputs: OrderInput[] = hubOrders.map(o => ({
      orderId: o.orderId,
      lat: o.address.lat,
      lng: o.address.lng,
      pincode: o.address.pincode,
      locality: o.city,
    }))
    
    const vehicleInput: VehicleInput = { 
      type: 'AUTO',
      maxDistanceKm: MAX_DISTANCE_KM,
      capacity: CAPACITY_MIN,
    }
    
    const hubConfig = {
      hubId: hubInfo.hubId,
      hubName: hubInfo.hubName,
      depotLat: hubInfo.depotLat,
      depotLng: hubInfo.depotLng,
      tier: hubInfo.hubId === 'warehouse' ? 'local' : 'hub' as 'local' | 'hub',
    }
    
    try {
      const result = cvrpRouteAssignmentService.computeRoutesForHub(orderInputs, vehicleInput, hubConfig)
      hubInfo.routes = result.routes
      totalCVRPRoutes += result.routes.length
      cvrpSuccessCount++
      console.log(`      ✅ CVRP succeeded: ${result.routes.length} routes in ${result.metadata.computationTimeMs}ms`)
    } catch (err: any) {
      cvrpFailCount++
      console.log(`      ❌ CVRP failed: ${err.message}`)
      console.log(`      Using fallback angular sweep...`)
      
      // Fallback: simple angular sweep
      const fallbackRoutes = fallbackClustering(hubOrders, hubInfo.depotLat, hubInfo.depotLng, CAPACITY_MAX)
      hubInfo.routes = fallbackRoutes
      totalCVRPRoutes += fallbackRoutes.length
    }
  }
  
  const totalClusterTime = Date.now() - clusterStartTime
  
  // ============================================================
  // HUB-WISE METRICS
  // ============================================================
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📊 HUB-WISE ROUTE METRICS`)
  console.log(`${'='.repeat(70)}`)
  
  const FUEL_EFFICIENCY_KM_PER_LITRE = 20
  const FUEL_COST_PER_LITRE = 90
  const AVG_SPEED_KMH = 30
  const STOP_TIME_MIN = 5
  
  let totalNaiveKm = 0
  let totalClusteredKm = 0
  let totalRoutesUnder8Hrs = 0
  let totalRoutesOver8Hrs = 0
  
  console.log(`\n${'─'.repeat(100)}`)
  console.log(
    `${'Hub'.padEnd(22)}` +
    `${'Orders'.padStart(7)}` +
    `${'Routes'.padStart(8)}` +
    `${'Avg Km'.padStart(10)}` +
    `${'Avg Time'.padStart(10)}` +
    `${'Max Time'.padStart(10)}` +
    `${'Fuel ₹'.padStart(10)}` +
    `  Status`
  )
  console.log(`${'─'.repeat(100)}`)
  
  for (const hubInfo of hubStats) {
    if (hubInfo.routes.length === 0) continue
    
    const hubOrders = hubGroups.get(hubInfo.hubId) || []
    
    // Naive distance for this hub
    const naiveKm = calculateNaiveDistance(hubOrders, hubInfo.depotLat, hubInfo.depotLng)
    totalNaiveKm += naiveKm
    
    // Calculate per-route metrics
    let hubClusteredKm = 0
    let maxTimeHrs = 0
    const routeTimes: number[] = []
    
    for (const route of hubInfo.routes) {
      const routeKm = calculateRouteDistance(route, orderMap)
      hubClusteredKm += routeKm
      
      const driveTimeMin = (routeKm / AVG_SPEED_KMH) * 60
      const stopTimeMin = route.orders.length * STOP_TIME_MIN
      const totalTimeHrs = (driveTimeMin + stopTimeMin) / 60
      
      routeTimes.push(totalTimeHrs)
      if (totalTimeHrs > maxTimeHrs) maxTimeHrs = totalTimeHrs
      
      if (totalTimeHrs <= 8) totalRoutesUnder8Hrs++
      else totalRoutesOver8Hrs++
    }
    
    totalClusteredKm += hubClusteredKm
    
    const avgKm = hubInfo.routes.length > 0 ? hubClusteredKm / hubInfo.routes.length : 0
    const avgTimeHrs = routeTimes.length > 0 ? routeTimes.reduce((a, b) => a + b, 0) / routeTimes.length : 0
    const fuelCost = (hubClusteredKm / FUEL_EFFICIENCY_KM_PER_LITRE) * FUEL_COST_PER_LITRE
    
    const status = maxTimeHrs <= 8 ? '✅ OK' : maxTimeHrs <= 10 ? '⚠️ LONG' : '❌ TOO LONG'
    
    console.log(
      `${hubInfo.hubName.padEnd(22)}` +
      `${String(hubInfo.orderCount).padStart(7)}` +
      `${String(hubInfo.routes.length).padStart(8)}` +
      `${avgKm.toFixed(1).padStart(9)} km` +
      `${(avgTimeHrs.toFixed(1) + 'h').padStart(10)}` +
      `${(maxTimeHrs.toFixed(1) + 'h').padStart(10)}` +
      `${fuelCost.toFixed(0).padStart(9)}` +
      `  ${status}`
    )
  }
  
  console.log(`${'─'.repeat(100)}`)
  
  // ============================================================
  // OVERALL SUMMARY
  // ============================================================
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📈 OVERALL SUMMARY`)
  console.log(`${'='.repeat(70)}`)
  
  const distanceSaved = totalNaiveKm - totalClusteredKm
  const savingsPercent = totalNaiveKm > 0 ? (distanceSaved / totalNaiveKm) * 100 : 0
  
  const naiveFuelCost = (totalNaiveKm / FUEL_EFFICIENCY_KM_PER_LITRE) * FUEL_COST_PER_LITRE
  const clusteredFuelCost = (totalClusteredKm / FUEL_EFFICIENCY_KM_PER_LITRE) * FUEL_COST_PER_LITRE
  const fuelSaved = naiveFuelCost - clusteredFuelCost
  
  console.log(`\n📦 CLUSTER OVERVIEW:`)
  console.log(`   Total Orders:          ${ORDER_COUNT}`)
  console.log(`   Total Routes:          ${totalCVRPRoutes}`)
  console.log(`   Hubs Used:             ${hubStats.filter(h => h.routes.length > 0).length}`)
  console.log(`   CVRP Success Rate:     ${cvrpSuccessCount}/${cvrpSuccessCount + cvrpFailCount} hubs`)
  console.log(`   Computation Time:      ${totalClusterTime}ms`)
  
  console.log(`\n📏 DISTANCE ANALYSIS:`)
  console.log(`   Naive (individual trips):   ${totalNaiveKm.toFixed(1)} km`)
  console.log(`   Clustered (optimized):      ${totalClusteredKm.toFixed(1)} km`)
  console.log(`   Distance Saved:             ${distanceSaved.toFixed(1)} km`)
  console.log(`   Savings Percentage:         ${savingsPercent.toFixed(1)}%`)
  
  console.log(`\n⛽ FUEL COST ANALYSIS:`)
  console.log(`   Assumption: Auto @ ${FUEL_EFFICIENCY_KM_PER_LITRE}km/L, ₹${FUEL_COST_PER_LITRE}/L`)
  console.log(`   Naive Fuel Cost:     ₹${naiveFuelCost.toFixed(0)}`)
  console.log(`   Clustered Fuel Cost: ₹${clusteredFuelCost.toFixed(0)}`)
  console.log(`   Fuel Money Saved:    ₹${fuelSaved.toFixed(0)} per day`)
  console.log(`   Monthly Savings:     ₹${(fuelSaved * 26).toFixed(0)} (26 working days)`)
  console.log(`   Yearly Savings:      ₹${(fuelSaved * 312).toFixed(0)} (312 working days)`)
  
  console.log(`\n⏱️  TIME ANALYSIS:`)
  console.log(`   Routes ≤ 8 hours:    ${totalRoutesUnder8Hrs} (${((totalRoutesUnder8Hrs/totalCVRPRoutes)*100).toFixed(1)}%)`)
  console.log(`   Routes > 8 hours:    ${totalRoutesOver8Hrs} (${((totalRoutesOver8Hrs/totalCVRPRoutes)*100).toFixed(1)}%)`)
  
  // Delivery boys needed per hub
  console.log(`\n🛺 DELIVERY BOYS NEEDED PER HUB:`)
  for (const hubInfo of hubStats) {
    if (hubInfo.routes.length === 0) continue
    const boysNeeded = Math.ceil(hubInfo.routes.length / 2) // Assume 2 routes per boy per day
    console.log(`   ${hubInfo.hubName.padEnd(25)} ${hubInfo.routes.length} routes → ${boysNeeded} delivery boys`)
  }
  
  // ============================================================
  // SYSTEM VERDICT
  // ============================================================
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🔍 SYSTEM VERDICT`)
  console.log(`${'='.repeat(70)}`)
  
  const issues: string[] = []
  const wins: string[] = []
  
  if (savingsPercent >= 60) wins.push(`✅ Excellent distance savings (${savingsPercent.toFixed(1)}%)`)
  else if (savingsPercent >= 40) wins.push(`✅ Good distance savings (${savingsPercent.toFixed(1)}%)`)
  else issues.push(`⚠️  Low savings (${savingsPercent.toFixed(1)}%)`)
  
  if (totalClusterTime < 2000) wins.push(`✅ Fast computation (${totalClusterTime}ms for ${ORDER_COUNT} orders)`)
  else if (totalClusterTime < 8000) wins.push(`⚠️  Acceptable computation (${totalClusterTime}ms)`)
  else issues.push(`❌ Slow computation (${totalClusterTime}ms)`)
  
  if (cvrpFailCount === 0) wins.push(`✅ CVRP running on all hubs (not fallback)`)
  else issues.push(`⚠️  ${cvrpFailCount} hubs using fallback clustering`)
  
  if (totalRoutesOver8Hrs === 0) wins.push(`✅ All routes ≤ 8 hours (completable in one working day)`)
  else if (totalRoutesOver8Hrs <= totalCVRPRoutes * 0.1) issues.push(`⚠️  ${totalRoutesOver8Hrs} routes exceed 8 hours`)
  else issues.push(`❌ ${totalRoutesOver8Hrs} routes exceed 8 hours - delivery boys will struggle`)
  
  if (totalRoutesUnder8Hrs >= totalCVRPRoutes * 0.9) wins.push(`✅ 90%+ routes completable in one shift`)
  
  wins.forEach(w => console.log(`   ${w}`))
  issues.forEach(i => console.log(`   ${i}`))
  
  if (issues.length === 0) {
    console.log(`\n🎉 HUB & SPOKE SYSTEM IS WORKING PERFECTLY`)
    console.log(`   All routes are completable in a working day.`)
    console.log(`   Ready for production deployment.`)
  } else if (issues.length <= 2) {
    console.log(`\n⚠️  SYSTEM IS WORKING WITH MINOR ISSUES`)
    console.log(`   Address the warnings above before peak load.`)
  } else {
    console.log(`\n❌ SYSTEM NEEDS FIXES BEFORE PRODUCTION`)
    console.log(`   Multiple issues found - review and fix.`)
  }
  
  console.log(`\n${'='.repeat(70)}`)
  console.log(`END OF HUB & SPOKE SIMULATION REPORT`)
  console.log(`${'='.repeat(70)}\n`)
}

// Fallback clustering for when CVRP fails
function fallbackClustering(orders: TestOrder[], depotLat: number, depotLng: number, maxCapacity: number): Route[] {
  const withAngles = orders.map(o => ({
    ...o,
    angle: Math.atan2(o.address.lat - depotLat, o.address.lng - depotLng),
    distance: calculateHaversineDistance({ lat: depotLat, lng: depotLng }, o.address)
  })).sort((a, b) => a.angle - b.angle)
  
  const routes: Route[] = []
  let current: any[] = []
  
  for (const order of withAngles) {
    current.push(order)
    if (current.length >= maxCapacity) {
      routes.push({
        routeId: `FALLBACK-R-${routes.length + 1}`,
        deliveryBoyId: null,
        orderCount: current.length,
        totalDistanceKm: 0,
        estimatedTimeMin: 0,
        orders: current.map(o => o.orderId),
        routePath: ['DEPOT', ...current.map(o => o.orderId)],
        hubId: 'fallback',
        hubName: 'Fallback',
        tier: 'hub',
        depotLat,
        depotLng,
        isOutlierRoute: false,
      })
      current = []
    }
  }
  
  if (current.length > 0) {
    routes.push({
      routeId: `FALLBACK-R-${routes.length + 1}`,
      deliveryBoyId: null,
      orderCount: current.length,
      totalDistanceKm: 0,
      estimatedTimeMin: 0,
      orders: current.map(o => o.orderId),
      routePath: ['DEPOT', ...current.map(o => o.orderId)],
      hubId: 'fallback',
      hubName: 'Fallback',
      tier: 'hub',
      depotLat,
      depotLng,
      isOutlierRoute: false,
    })
  }
  
  return routes
}

runSimulation().catch(console.error)
