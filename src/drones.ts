export type Telemetry = {
  id: string;
  longitude: number;
  latitude: number;
  heading: number;
};

type Drone = Telemetry & {
  turn: 1 | -1; // +1 right, -1 left
  turnFor: number; // seconds until the turn reverses
};

const CENTER = {
  longitude: -117.918031,
  latitude: 33.693477,
};

const SEEDS = [
  { id: "drone-1", longitude: 0, latitude: 0, heading: 0, turn: 1, turnFor: 5 },
  { id: "drone-2", longitude: 0.03, latitude: 0.02, heading: 45, turn: -1, turnFor: 2 },
  { id: "drone-3", longitude: -0.025, latitude: 0.03, heading: 120, turn: 1, turnFor: 4 },
  { id: "drone-4", longitude: 0.02, latitude: -0.03, heading: 200, turn: -1, turnFor: 1 },
  { id: "drone-5", longitude: -0.03, latitude: -0.02, heading: 300, turn: 1, turnFor: 3 },
] as const;

const METERS_PER_DEGREE = 111_320;
const SPEED_METERS_PER_SECOND = 500;
const TURN_DEGREES_PER_SECOND = 8;
const TURN_HOLD_SECONDS = 5;

export function createDrones(): Drone[] {
  return SEEDS.map((seed) => ({
    id: seed.id,
    longitude: CENTER.longitude + seed.longitude,
    latitude: CENTER.latitude + seed.latitude,
    heading: seed.heading,
    turn: seed.turn,
    turnFor: seed.turnFor,
  }));
}

export function stepDrones(drones: Drone[], dtSeconds: number) {
  const meters = SPEED_METERS_PER_SECOND * dtSeconds;
  const turn = TURN_DEGREES_PER_SECOND * dtSeconds;

  for (const drone of drones) {
    const heading = (drone.heading * Math.PI) / 180;
    const latitude = (drone.latitude * Math.PI) / 180;
    drone.latitude += (Math.cos(heading) * meters) / METERS_PER_DEGREE;
    drone.longitude +=
      (Math.sin(heading) * meters) /
      (METERS_PER_DEGREE * Math.cos(latitude));
    drone.heading = (drone.heading + drone.turn * turn + 360) % 360;
    drone.turnFor -= dtSeconds;
    if (drone.turnFor <= 0) {
      drone.turn = drone.turn === 1 ? -1 : 1;
      drone.turnFor += TURN_HOLD_SECONDS;
    }
  }
}

export function telemetry(drones: Drone[]): Telemetry[] {
  return drones.map(({ id, longitude, latitude, heading }) => ({
    id,
    longitude,
    latitude,
    heading,
  }));
}
