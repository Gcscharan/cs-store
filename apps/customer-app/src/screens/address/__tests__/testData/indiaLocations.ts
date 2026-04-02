export const indiaLocations = [ 
  { lat: 17.385, lng: 78.4867, city: 'Hyderabad' }, 
  { lat: 12.9716, lng: 77.5946, city: 'Bangalore' }, 
  { lat: 19.076, lng: 72.8777, city: 'Mumbai' }, 
  { lat: 28.6139, lng: 77.209, city: 'Delhi' }, 
  { lat: 13.0827, lng: 80.2707, city: 'Chennai' }, 
 
  // 👇 Generate more programmatically 
  ...Array.from({ length: 995 }).map((_, i) => ({ 
    lat: 8 + Math.random() * 29,   // India latitude range 
    lng: 68 + Math.random() * 29,  // India longitude range 
    city: 'Unknown', 
  })), 
]; 
