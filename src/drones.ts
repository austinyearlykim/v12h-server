export type Status = "Patrolling" | "RTB" | "Charging";

export type Telemetry = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  heading: number;
  battery: number;
  status: Status;
};

export type Origin = {
  name: string;
  place: string;
  longitude: number;
  latitude: number;
};

export type TelemetryFrame = {
  origin: Origin;
  drones: Telemetry[];
};

type Drone = Omit<Telemetry, "status"> & {
  turn: 1 | -1; // +1 right, -1 left
  turnFor: number; // seconds until the turn reverses
  mode: "fly" | "return" | "charge";
  batteryUsed: number; // fractional percent drained, not yet taken from battery
  chargeFor: number;
  chargeFrom: number;
};

const CENTER = {
  name: "Anduril HQ",
  place: "Costa Mesa",
  longitude: -117.918031,
  latitude: 33.693477,
};

const SEEDS = [
  { name: "Kestrel", longitude: 0, latitude: 0, heading: 0, turn: 1, turnFor: 5 },
  { name: "Nimbus", longitude: 0.03, latitude: 0.02, heading: 45, turn: -1, turnFor: 2 },
  { name: "Osprey", longitude: -0.025, latitude: 0.03, heading: 120, turn: 1, turnFor: 4 },
  { name: "Quill", longitude: 0.02, latitude: -0.03, heading: 200, turn: -1, turnFor: 1 },
  { name: "Vesper", longitude: -0.03, latitude: -0.02, heading: 300, turn: 1, turnFor: 3 },
] as const;

function droneId(used: Set<string>) {
  let id = "";
  do {
    id = String(10_000_000 + Math.floor(Math.random() * 90_000_000));
  } while (used.has(id));
  used.add(id);
  return id;
}

const METERS_PER_DEGREE = 111_320;
const SPEED_METERS_PER_SECOND = 100;
const TURN_DEGREES_PER_SECOND = 8;
const TURN_HOLD_SECONDS = 5;
const BATTERY_DRAIN_PER_SECOND = 1;
const RETURN_BATTERY = 60;
const CHARGE_SECONDS = 3;

function startingBattery() {
  return 66 + Math.floor(Math.random() * 35);
}

export function createDrones(): Drone[] {
  const used = new Set<string>();
  return SEEDS.map((seed) => ({
    id: droneId(used),
    name: seed.name,
    longitude: CENTER.longitude + seed.longitude,
    latitude: CENTER.latitude + seed.latitude,
    heading: seed.heading,
    turn: seed.turn,
    turnFor: seed.turnFor,
    battery: startingBattery(),
    batteryUsed: 0,
    mode: "fly",
    chargeFor: 0,
    chargeFrom: 0,
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

function drainBattery(drone: Drone, dtSeconds: number) {
  drone.batteryUsed += BATTERY_DRAIN_PER_SECOND * dtSeconds;
  const lost = Math.floor(drone.batteryUsed);
  if (lost <= 0) return;
  drone.battery = Math.max(0, drone.battery - lost);
  drone.batteryUsed -= lost;
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
    if (drone.mode === "charge") {
      drone.chargeFor -= dtSeconds;
      const charged = Math.min(1, 1 - drone.chargeFor / CHARGE_SECONDS);
      drone.battery = Math.round(drone.chargeFrom + (100 - drone.chargeFrom) * charged);
      if (drone.chargeFor <= 0) {
        drone.battery = 100;
        drone.batteryUsed = 0;
        drone.mode = "fly";
      }
      continue;
    }

    drainBattery(drone, dtSeconds);
    if (drone.mode === "fly" && drone.battery <= RETURN_BATTERY) {
      drone.mode = "return";
    }

    if (drone.mode === "return") {
      drone.heading = headingTowardOrigin(drone);
      if (distanceFromOrigin(drone) <= meters) {
        drone.longitude = CENTER.longitude;
        drone.latitude = CENTER.latitude;
        drone.mode = "charge";
        drone.chargeFor = CHARGE_SECONDS;
        drone.chargeFrom = drone.battery;
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

export function telemetry(drones: Drone[]): TelemetryFrame {
  return {
    origin: {
      name: CENTER.name,
      place: CENTER.place,
      longitude: CENTER.longitude,
      latitude: CENTER.latitude,
    },
    drones: drones.map((drone) => ({
      id: drone.id,
      name: drone.name,
      longitude: drone.longitude,
      latitude: drone.latitude,
      heading: drone.heading,
      battery: drone.battery,
      status: drone.mode === "charge" ? "Charging" : drone.mode === "return" ? "RTB" : "Patrolling",
    })),
  };
}
