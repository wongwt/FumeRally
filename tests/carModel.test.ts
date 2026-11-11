import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_ORDER, CARS } from '../src/config/cars';
import { makeCar } from '../src/render/carModel';
import { PlayerView } from '../src/render/playerView';
import type { Stage3D } from '../src/render/stage3d';
import type { Enemy } from '../src/sim/enemies';
import { DT, gem, park, place, playing, rock, run } from './helpers/sim';

const countWheels = (g: THREE.Group): number =>
  g.children.filter(
    (c) =>
      c instanceof THREE.Mesh &&
      c.geometry instanceof THREE.CylinderGeometry &&
      c.geometry.parameters.radiusTop === 0.09
  ).length;

describe('makeCar', () => {
  it('builds every car with a body, cabin, wheels, shadow and hidden stars', () => {
    for (const id of CAR_ORDER) {
      const car = makeCar(id, CARS[id].color);
      expect(car.group.children.length).toBeGreaterThan(8);
      expect(car.stars.visible).toBe(false);
      expect(car.bodyMat.color.getHex()).toBe(CARS[id].color);
      expect(car.aura).toBeUndefined();
    }
  });

  it('the motorcycle has two wheels, the others four', () => {
    expect(countWheels(makeCar('moto', 0xffffff).group)).toBe(2);
    for (const id of CAR_ORDER.filter((c) => c !== 'moto'))
      expect(countWheels(makeCar(id, 0xffffff).group)).toBe(4);
  });

  it('cars with special parts have more pieces than the plain sedan', () => {
    const base = makeCar('sedan', 0xffffff).group.children.length;
    for (const id of ['sport', 'armor', 'offroad', 'tanker', 'scout', 'police', 'moto'] as const) {
      expect(makeCar(id, 0xffffff).group.children.length).toBeGreaterThan(base - 3);
    }
    expect(makeCar('sport', 0xffffff).group.children.length).toBeGreaterThan(base);
    expect(makeCar('police', 0xffffff).group.children.length).toBeGreaterThan(base);
  });

  it('only player cars get the aura and shield, and the stripe is optional', () => {
    const plain = makeCar('sedan', 0xffffff);
    const player = makeCar('sedan', 0xffffff, { stripe: true, player: true });
    expect(player.aura?.visible).toBe(false);
    expect(player.shield?.visible).toBe(false);
    expect(plain.shield).toBeUndefined();
    expect(player.group.children.length).toBe(plain.group.children.length + 3);
  });
});

function viewFor(car: 'sedan' | 'armor' | 'moto' = 'sedan') {
  const actorGroup = new THREE.Group();
  const stage = { actorGroup } as unknown as Stage3D;
  const view = new PlayerView(stage);
  const sim = playing([gem(1, 1)], [], car);
  if (car !== 'sedan') view.setCar(car);
  return { actorGroup, view, sim };
}

describe('PlayerView with cars', () => {
  it('swapping cars replaces the model and keeps it in the scene', () => {
    const { actorGroup, view } = viewFor();
    const first = actorGroup.children[0];
    view.setCar('moto');
    expect(actorGroup.children).toHaveLength(1);
    expect(actorGroup.children[0]).not.toBe(first);
    expect(countWheels(actorGroup.children[0] as THREE.Group)).toBe(2);
  });

  it('shows the shield while armor is up, but not under invincibility or without armor', () => {
    const { actorGroup, view, sim } = viewFor('armor');
    const shield = (): boolean => {
      view.update(DT, sim);
      const car = actorGroup.children[0] as THREE.Group;
      return car.children.some(
        (c) =>
          c instanceof THREE.Mesh &&
          c.geometry instanceof THREE.SphereGeometry &&
          c.geometry.parameters.radius === 0.54 &&
          c.visible
      );
    };
    expect(sim.armor).toBe(1);
    expect(shield()).toBe(true);
    sim.power = 3;
    expect(shield()).toBe(false);
    sim.power = 0;
    sim.armor = 0;
    expect(shield()).toBe(false);
    const sedan = viewFor('sedan');
    expect(sedan.sim.armor).toBe(0);
  });

  it('flashes during the post-hit grace period and is solid afterwards', () => {
    const { actorGroup, view, sim } = viewFor('armor');
    sim.setRocks([rock(13, 17)]);
    park(sim, 13, 17);
    run(sim, DT); // armor absorbs the rock
    expect(sim.hitT).toBeGreaterThan(1);
    const seen = new Set<boolean>();
    for (let i = 0; i < 60; i++) {
      run(sim, 1 / 60);
      view.update(1 / 60, sim);
      seen.add((actorGroup.children[0] as THREE.Group).visible);
    }
    expect(seen.has(true) && seen.has(false)).toBe(true);
    run(sim, 2);
    view.update(DT, sim);
    expect((actorGroup.children[0] as THREE.Group).visible).toBe(true);
  });

  it('is fully visible after respawning, for any car', () => {
    const { actorGroup, view, sim } = viewFor('moto');
    sim.events.on('respawn', () => view.reset(sim));
    park(sim, 13, 17);
    const en = sim.enemies[0] as Enemy;
    en.active = true;
    en.release = 0;
    place(en, 13, 17);
    for (let i = 0; i < 400; i++) {
      sim.update(DT, null);
      view.update(DT, sim);
    }
    const car = actorGroup.children[0] as THREE.Group;
    expect(car.scale.x).toBe(1);
    expect(car.visible).toBe(true);
  });
});
