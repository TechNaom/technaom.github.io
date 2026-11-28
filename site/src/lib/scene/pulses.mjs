// Signals (R11): a fixed pool of small pulses travelling along random links while the scene idles.
// No allocation per frame: one InstancedMesh, one state array, one reused Object3D.
import { InstancedMesh, IcosahedronGeometry, MeshBasicMaterial, Object3D } from "three";
import { mulberry32 } from "./rng.mjs";

const PARKED = -1000; // free slots wait far behind the camera

/** createPulses({ links, seed, count, disposables }) → { mesh, step(dt, positions), launched() }. */
export function createPulses({ links, seed = 2026, count = 24, disposables }) {
  const rand = mulberry32(seed + 1);
  const geo = new IcosahedronGeometry(0.09, 1);
  const mat = new MeshBasicMaterial({ color: 0xe8f6fc });
  const mesh = new InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  disposables.push(geo, mat, mesh);
  const state = Array.from({ length: count }, () => ({ link: 0, t: 1, speed: 0 })); // t >= 1: free
  const dummy = new Object3D();
  let launched = 0;

  const park = (i) => {
    dummy.position.set(0, 0, PARKED);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  for (let i = 0; i < count; i++) park(i);

  /** Advance every pulse by dt ms along the current node positions (3 numbers per node). */
  const step = (dt, positions) => {
    if (!links.length) return;
    for (let i = 0; i < count; i++) {
      const st = state[i];
      if (st.t >= 1) {
        if (rand() > dt / 400) { // a free slot launches about once every 400 ms
          if (st.link !== -1) { park(i); st.link = -1; } // park once, not every frame
          continue;
        }
        st.link = Math.floor(rand() * links.length);
        st.t = 0;
        st.speed = 0.0004 + rand() * 0.0006;
        launched++;
      }
      const link = links[st.link], a = link[0] * 3, b = link[1] * 3, k = st.t;
      dummy.position.set(
        positions[a] + (positions[b] - positions[a]) * k,
        positions[a + 1] + (positions[b + 1] - positions[a + 1]) * k,
        positions[a + 2] + (positions[b + 2] - positions[a + 2]) * k,
      );
      st.t += dt * st.speed;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  return { mesh, step, launched: () => launched };
}
