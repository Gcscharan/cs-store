import { cvrpRouteAssignmentService, OrderInput, VehicleInput } from '../services/cvrpRouteAssignmentService'
import { calculateHaversineDistance } from '../utils/routeUtils'

// Generate orders within 25km of a hub (realistic last-mile scenario)
function generateLocalOrders(lat: number, lng: number, count: number, maxRadiusKm: number): OrderInput[] {
  const orders: OrderInput[] = []
  for (let i = 0; i < count; i++) {
    const radiusDeg = maxRadiusKm / 111 // ~111km per degree latitude
    const angle = Math.random() * 2 * Math.PI
    const r = Math.random() * radiusDeg
    orders.push({
      orderId: `ORD-${String(i).padStart(4, '0')}`,
      lat: lat + r * Math.cos(angle),
      lng: lng + r * Math.sin(angle) / Math.cos(lat * Math.PI / 180),
    })
  }
  return orders
}

console.log('='.repeat(70))
console.log('HUB & SPOKE - REALISTIC LAST-MILE TEST')
console.log('Orders concentrated within 25km of each hub')
console.log('='.repeat(70))

const HUBS = [
  { id: 'hub_vijayawada', name: 'Vijayawada Hub', lat: 16.5062, lng: 80.6480, orderCount: 100 },
  { id: 'hub_hyderabad', name: 'Hyderabad Hub', lat: 17.3850, lng: 78.4867, orderCount: 150 },
  { id: 'hub_visakhapatnam', name: 'Visakhapatnam Hub', lat: 17.6868, lng: 83.2185, orderCount: 80 },
  { id: 'hub_warangal', name: 'Warangal Hub', lat: 17.9784, lng: 79.5941, orderCount: 70 },
  { id: 'hub_guntur', name: 'Guntur Hub', lat: 16.3067, lng: 80.4365, orderCount: 100 },
]

const WAREHOUSE = { id: 'warehouse', name: 'Warehouse (Local)', lat: 17.094, lng: 80.598, orderCount: 50 }

const allHubs = [...HUBS, WAREHOUSE]

let totalOrders = 0
let totalRoutes = 0
let cvrpSuccess = 0
let cvrpFail = 0
let routesUnder8h = 0
let routesOver8h = 0

console.log('\n🏭 HUB-WISE CLUSTERING RESULTS:\n')
console.log(`${'Hub'.padEnd(22)} ${'Orders'.padStart(6)} ${'Routes'.padStart(7)} ${'Avg Km'.padStart(8)} ${'Max Hrs'.padStart(8)} Status`)
console.log('-'.repeat(70))

for (const hub of allHubs) {
  const maxRadius = hub.id === 'warehouse' ? 35 : 25
  const orders = generateLocalOrders(hub.lat, hub.lng, hub.orderCount, maxRadius)
  totalOrders += orders.length

  const vehicle: VehicleInput = { 
    type: 'AUTO', 
    maxDistanceKm: 60, 
    capacity: 15 
  }
  
  const hubConfig = {
    hubId: hub.id,
    hubName: hub.name,
    depotLat: hub.lat,
    depotLng: hub.lng,
    tier: (hub.id === 'warehouse' ? 'local' : 'hub') as 'local' | 'hub',
  }

  try {
    const result = cvrpRouteAssignmentService.computeRoutesForHub(orders, vehicle, hubConfig)
    totalRoutes += result.routes.length
    cvrpSuccess++

    let totalKm = 0
    let maxTimeHrs = 0

    for (const route of result.routes) {
      let dist = 0
      let prev = { lat: hub.lat, lng: hub.lng }
      
      for (const orderId of route.orders) {
        const order = orders.find(o => o.orderId === orderId)
        if (order) {
          dist += calculateHaversineDistance(prev, order)
          prev = order
        }
      }
      dist += calculateHaversineDistance(prev, { lat: hub.lat, lng: hub.lng })
      totalKm += dist

      const timeHrs = ((dist / 30) * 60 + route.orders.length * 5) / 60
      if (timeHrs > maxTimeHrs) maxTimeHrs = timeHrs
      
      if (timeHrs <= 8) routesUnder8h++
      else routesOver8h++
    }

    const avgKm = result.routes.length > 0 ? totalKm / result.routes.length : 0
    const status = maxTimeHrs <= 8 ? '✅ OK' : maxTimeHrs <= 10 ? '⚠️ LONG' : '❌ TOO LONG'

    console.log(`${hub.name.padEnd(22)} ${String(orders.length).padStart(6)} ${String(result.routes.length).padStart(7)} ${avgKm.toFixed(1).padStart(7)}km ${maxTimeHrs.toFixed(1).padStart(7)}h  ${status}`)
  } catch (err: any) {
    cvrpFail++
    console.log(`${hub.name.padEnd(22)} ${String(orders.length).padStart(6)} CVRP FAILED: ${err.message}`)
  }
}

console.log('-'.repeat(70))
console.log('\n' + '='.repeat(70))
console.log('📊 SUMMARY:')
console.log('='.repeat(70))
console.log(`   Total Orders:        ${totalOrders}`)
console.log(`   Total Routes:        ${totalRoutes}`)
console.log(`   CVRP Success:        ${cvrpSuccess}/${cvrpSuccess + cvrpFail} hubs`)
console.log(`   Routes ≤ 8 hours:    ${routesUnder8h} (${((routesUnder8h/totalRoutes)*100).toFixed(1)}%)`)
console.log(`   Routes > 8 hours:    ${routesOver8h} (${((routesOver8h/totalRoutes)*100).toFixed(1)}%)`)

if (routesOver8h === 0 && cvrpFail === 0) {
  console.log('\n🎉 HUB & SPOKE SYSTEM IS WORKING PERFECTLY!')
  console.log('   All routes are completable in a working day.')
} else if (routesOver8h <= totalRoutes * 0.1) {
  console.log('\n⚠️  SYSTEM IS WORKING WITH MINOR ISSUES')
} else {
  console.log('\n❌ SYSTEM NEEDS OPTIMIZATION')
}

console.log('='.repeat(70))
