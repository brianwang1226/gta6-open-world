// Combat: the pistol, bullets, explosions and particles. Bullets fly straight and fast and
// hurt whatever they touch — pedestrians, gang cars, cop cars, and (in the wrong hands) the
// player. Particles are pure feedback: muzzle sparks, bloodless hits, smoke and fire.
import { BULLET } from './config.js';

export function createCombat() {
  return { bullets: [], particles: [], shootCooldown: 0 };
}

export function fire(combat, x, y, angle, fromPlayer) {
  if (combat.shootCooldown > 0) return false;
  combat.shootCooldown = 0.22;
  combat.bullets.push({
    x, y,
    vx: Math.cos(angle) * BULLET.speed,
    vy: Math.sin(angle) * BULLET.speed,
    life: BULLET.life,
    fromPlayer,
  });
  spawnParticles(combat, x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, 3, '#ffd76a', 130);
  return true;
}

export function spawnParticles(combat, x, y, n, color, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 90) * (0.4 + Math.random() * 0.8);
    combat.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, max: 0.8, color, size: 2 + Math.random() * 3 });
  }
}

export function explode(combat, x, y) {
  spawnParticles(combat, x, y, 26, '#ff8a3a', 260);
  spawnParticles(combat, x, y, 16, '#3a3a3a', 120);
  spawnParticles(combat, x, y, 10, '#ffd76a', 340);
}

/**
 * Step bullets and particles. `hit` is called for every bullet impact with (bullet, kind, target)
 * where kind is 'ped' | 'car' | 'cop' | 'player' | 'wall'. Returns nothing; the world applies damage.
 */
export function stepCombat(combat, world, dt) {
  combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
  const { city, player } = world;
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Walls: a bullet that leaves the road grid into a building dies in a spark.
      if (b.x < 0 || b.y < 0 || b.x > city.width || b.y > city.height) dead = true;
    }
    if (!dead && b.fromPlayer) {
      // Hit a pedestrian?
      for (const ped of world.traffic.peds) {
        if (!ped.dead && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.dead = true;
          spawnParticles(combat, ped.x, ped.y, 8, '#c85a5a', 140);
          world.onPedShot(ped);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of world.traffic.cars) {
          if (car.dead) continue;
          const dx = car.x - b.x;
          const dy = car.y - b.y;
          const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
          const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
          if (along < 26 && side < 14) {
            car.hp -= BULLET.damage;
            car.flash = 0.12;
            spawnParticles(combat, b.x, b.y, 5, '#ffd76a', 160);
            world.onCarShot(car);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const cop of world.police.footCops) {
          if (!cop.dead && Math.hypot(cop.x - b.x, cop.y - b.y) < 12) {
            cop.dead = true;
            spawnParticles(combat, cop.x, cop.y, 8, '#4a6a8a', 140);
            world.onCopShot(cop);
            dead = true;
            break;
          }
        }
      }
    } else if (!dead && !b.fromPlayer) {
      // Gang bullets hurt the player (on foot) and his car.
      if (player.onFoot) {
        if (Math.hypot(player.x - b.x, player.y - b.y) < 14) {
          world.hurtPlayer(BULLET.damage * 0.6);
          dead = true;
        }
      } else if (player.car) {
        const car = player.car;
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (along < 26 && side < 14) {
          car.hp -= BULLET.damage * 0.5;
          dead = true;
        }
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }

  for (let i = combat.particles.length - 1; i >= 0; i -= 1) {
    const p = combat.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt;
    if (p.life <= 0) combat.particles.splice(i, 1);
  }
}
