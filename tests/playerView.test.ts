import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PlayerView } from '../src/render/playerView';
import type { Stage3D } from '../src/render/stage3d';
import { Sim } from '../src/sim/sim';
import { DT, gem, park, place, playing, run } from './helpers/sim';

/** Wires a PlayerView to a Sim the way Game does: update every step, reset on 'respawn'. */
function setup() {
  const actorGroup = new THREE.Group();
  const view = new PlayerView({ actorGroup } as unknown as Stage3D);
  const sim = playing([gem(1, 1)]);
  sim.events.on('respawn', () => view.reset(sim));
  const car = actorGroup.children[0] as THREE.Group;
  const step = (seconds: number): void => {
    for (let t = 0; t < seconds - 1e-9; t += DT) {
      sim.update(DT, null);
      view.update(DT, sim);
    }
  };
  return { sim, view, car, step };
}

describe('PlayerView after a crash', () => {
  it('shrinks away while crashing', () => {
    const { sim, car, step } = setup();
    sim.setRocks([{ x: 13, y: 17, rx: 0, ry: 0, rz: 0, sx: 1, sz: 1, broken: false }]);
    park(sim, 13, 17);
    step(0.6);
    expect(sim.phase).toBe('dying');
    expect(car.scale.x).toBeLessThan(0.6);
  });

  it('is full size and visible again once respawned', () => {
    const { sim, car, step } = setup();
    sim.setRocks([{ x: 13, y: 17, rx: 0, ry: 0, rz: 0, sx: 1, sz: 1, broken: false }]);
    park(sim, 13, 17);
    step(0.3); // crash
    sim.setRocks([]);
    step(1.4); // dying -> respawn -> ready
    expect(sim.phase).toBe('ready');
    expect(car.scale.x).toBe(1);
    expect(car.visible).toBe(true);
    step(2.5); // and into play again
    expect(sim.phase).toBe('play');
    expect(car.scale.x).toBe(1);
  });

  it('is full size after being caught by a chaser', () => {
    const { sim, car, step } = setup();
    const en = sim.enemies[0]!;
    en.active = true;
    en.release = 0;
    park(sim, 13, 17);
    place(en, 13, 17);
    step(0.3);
    expect(sim.crashWhy).toBe('caught');
    step(1.4);
    expect(sim.phase).toBe('ready');
    expect(car.scale.x).toBe(1);
  });

  it('faces the start direction again and sits on the start tile', () => {
    const { sim, car, step } = setup();
    sim.setRocks([{ x: 13, y: 17, rx: 0, ry: 0, rz: 0, sx: 1, sz: 1, broken: false }]);
    park(sim, 13, 17);
    step(0.3);
    sim.setRocks([]);
    step(1.4);
    expect(car.position.x).toBeCloseTo(0, 5); // x = 13 is the centre column
    expect(car.position.z).toBeCloseTo(17 - 19 / 2 + 0.5, 5);
  });

  it('still starts at full size on a brand new game', () => {
    const sim = new Sim();
    const actorGroup = new THREE.Group();
    const view = new PlayerView({ actorGroup } as unknown as Stage3D);
    view.update(DT, sim);
    expect((actorGroup.children[0] as THREE.Group).scale.x).toBe(1);
    run(sim, 0.1);
  });
});
