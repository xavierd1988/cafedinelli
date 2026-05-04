// État partagé : à quel siège je suis assis (local). Permet à n'importe quel
// composant Seat de savoir s'il est mon siège ou pas, donc de bloquer un
// clic sur tout autre tabouret tant que je suis encore là.

let mySeatId = null;
const listeners = new Set();

export function getMySeat() {
  return mySeatId;
}

export function setMySeat(id) {
  mySeatId = id;
  listeners.forEach((fn) => fn(id));
}

export function subscribeMySeat(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
