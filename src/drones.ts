export type Telemetry = {
  id: string;
  longitude: number;
  latitude: number;
  heading: number;
};

type Drone = Telemetry & {
  turn: 1 | -1; // +1 right, -1 left
  turnFor: number; // seconds until the turn reverses
  mode: "fly" | "return" | "pause";
  pauseFor: number;
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
const METERS_PER_MILE = 1_609.344;
const SPEED_METERS_PER_SECOND = 500;
const TURN_DEGREES_PER_SECOND = 8;
const TURN_HOLD_SECONDS = 5;
const RETURN_MILES = 15;
const RETURN_DISTANCE_METERS = RETURN_MILES * METERS_PER_MILE;
const PAUSE_SECONDS = 3;

export function createDrones(): Drone[] {
  return SEEDS.map((seed) => ({
    id: seed.id,
    longitude: CENTER.longitude + seed.longitude,
    latitude: CENTER.latitude + seed.latitude,
    heading: seed.heading,
    turn: seed.turn,
    turnFor: seed.turnFor,
    mode: "fly",
    pauseFor: 0,
  }));
}

function distanceFromOrigin(drone: Drone) {
  const latitude = (drone.latitude * Math.PI) / 180;
  const north = (drone.latitude - CENTER.latitude) * METERS_PER_DEGREE;
  const east =
    (drone.longitude - CENTER.longitude) * METERS_PER_DEGREE * Math.cos(latitude);
  return Math.hypot(east, north);
}

function headingTowardOrigin(drone: Drone) {
  const latitude = (drone.latitude * Math.PI) / 180;
  const north = CENTER.latitude - drone.latitude;
  const east = (CENTER.longitude - drone.longitude) * Math.cos(latitude);
  return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

function move(drone: Drone, meters: number) {
  const heading = (drone.heading * Math.PI) / 180;
  const latitude = (drone.latitude * Math.PI) / 180;
  drone.latitude += (Math.cos(heading) * meters) / METERS_PER_DEGREE;
  drone.longitude +=
    (Math.sin(heading) * meters) / (METERS_PER_DEGREE * Math.cos(latitude));
}

export function stepDrones(drones: Drone[], dtSeconds: number) {
  const meters = SPEED_METERS_PER_SECOND * dtSeconds;
  const turn = TURN_DEGREES_PER_SECOND * dtSeconds;

  for (const drone of drones) {
    if (drone.mode === "pause") {
      drone.pauseFor -= dtSeconds;
      if (drone.pauseFor <= 0) drone.mode = "fly";
      continue;
    }

    if (
      drone.mode === "fly" &&
      distanceFromOrigin(drone) > RETURN_DISTANCE_METERS
    ) {
      drone.mode = "return";
    }

    if (drone.mode === "return") {
      drone.heading = headingTowardOrigin(drone);
      if (distanceFromOrigin(drone) <= meters) {
        drone.longitude = CENTER.longitude;
        drone.latitude = CENTER.latitude;
        drone.mode = "pause";
        drone.pauseFor = PAUSE_SECONDS;
        continue;
      }
      move(drone, meters);
      continue;
    }

    move(drone, meters);
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
