import * as B from "@babylonjs/core";
import * as G from "@babylonjs/gui";
import * as M from "mobx";
import * as T from "../lib/triangulation";
import { radToDeg } from "../lib/utils";
import CheckeredTexture from "./CheckeredTexture";
// import { log } from "./debug";

M.configure({
  enforceActions: "never",
  // computedRequiresReaction: false,
  // reactionRequiresObservable: false,
  // observableRequiresReaction: false,
  // isolateGlobalState: false,
  // useProxies: "never",
});


// Abbreviations:
type V3 = B.Vector3;
const V3 = B.Vector3;
const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

const gray = B.Color3.Gray();
const black = B.Color3.Black();

const TAU = 2 * Math.PI;


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

const createStandardMaterial = (
  name: string,
  options: Partial<B.StandardMaterial>,
  scene?: B.Scene
): B.StandardMaterial =>
  Object.assign(new B.StandardMaterial(name, scene), options);

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0, 0, 0, 0);

const advancedTexture = G.AdvancedDynamicTexture.CreateFullscreenUI("myUI", true, scene);
advancedTexture.rootContainer.scaleX = window.devicePixelRatio;
advancedTexture.rootContainer.scaleY = window.devicePixelRatio;

const camera = new B.ArcRotateCamera("camera", .15 * TAU, .2 * TAU, 3, v3(0, 0, 0), scene);
camera.lowerRadiusLimit = 2.1;
camera.upperRadiusLimit = 10;
camera.attachControl(undefined, true);

const light = new B.HemisphericLight('light1', v3(0, 1, 0), scene);
light.intensity = 0.8;

const light2 = new B.DirectionalLight("light2", v3(10, -2, -10), scene);
light2.intensity = 0.8;

const light3 = new B.DirectionalLight("light3", v3(3, 10, 10), scene);
light3.intensity = 0.5;

const light4 = new B.DirectionalLight("light4", v3(-10, 3, -3), scene);
light4.intensity = 0.5;


([[1,0,0], [0,1,0], [0,0,1]] as [number, number, number][])
.forEach((dims, i) => {
  const color = new B.Color3(...dims);
  const arrow = B.MeshBuilder.CreateTube("arrow-" + i, {
    path: [0, .9, .9, 1].map(s => v3(...dims).scaleInPlace(s)),
    radiusFunction: i => [.008, .008, .024, 0][i],
  }, scene);
  arrow.material = createStandardMaterial("arrowMat", {
    diffuseColor: color,
    // emissiveColor: color,
  }, scene);

  const labelPos = new B.TransformNode("labelPos" + i, scene);
  labelPos.position = v3(...dims).scaleInPlace(1.1);
  const label = new G.TextBlock("label" + i, "xyz"[i]);
  label.color = "#" + dims.map(dim => "0f"[dim]).join("");
  label.fontSize = 24;
  advancedTexture.addControl(label);
  label.linkWithMesh(labelPos);
});

// Allow to hide some vertices temporarily inside the origin
const origin = B.MeshBuilder.CreateIcoSphere("origin", {
  radius: 0.02,
}, scene);
origin.material =
  createStandardMaterial("originMat", {diffuseColor: black}, scene);


const adjacentMaterial = createStandardMaterial("adjMat", {
  diffuseColor: gray,
  alpha: 0.5,
  wireframe: true,
}, scene);


class EighthSphereTriangulation extends B.Mesh {
  constructor(
    name: string,
    options: {
      steps?: number,
      triangulationFn: (steps: number) => T.Triangulation,
      smooth: boolean,
      adjShape: AdjacentShape;
    },
    scene?: B.Scene
  ) {
    super(name, scene);

    const {
      steps = 6,
      triangulationFn,
      smooth,
      adjShape,
    } = options;

    // ========== VERTEX UTILS ==========

    /**
     * Total number of vertices in the first `i` vertex rows
     * in a sub-triangulated triangle
     */
    const rowVertices = (i: number) =>
      // This would be `i * (steps + 1)` if all rows had `steps + 1` vertices.
      // Subtract `i * (i - 1) / 2` to correct for the decreasing row lengths.
      // Then simplify the formula:
      i * (2 * steps + 3 - i) / 2;
    const nVertices = rowVertices(steps + 1);
    const normals = new Float32Array(nVertices * 3);
    const uvs = new Float32Array(nVertices * 2);

    /** Compute a vertex index from the "logical" vertex position */
    const vtx = (i: number, j: number): number =>
      rowVertices(i) + j;

    function setVertexData(idx: number, normal: B.Vector3, u: number, v: number): void {
      normals[idx*3 + 0] = normal.x;
      normals[idx*3 + 1] = normal.y;
      normals[idx*3 + 2] = normal.z;
      uvs[idx*2 + 0] = u;
      uvs[idx*2 + 1] = v;
    }

    // ========== TRIANGLE UTILS ==========

    const nTriangles = 6 * 2 + 12 * steps * 2 + 8 * steps**2;
    const indices = new Uint32Array(nTriangles * 3);

    let vertexIdx = 0;

    function triangle(vtxLocal: (u: number, v: number) => number) {
      indices[vertexIdx * 3 + 0] = vtxLocal(0, 0);
      indices[vertexIdx * 3 + 1] = vtxLocal(0, 1);
      indices[vertexIdx * 3 + 2] = vtxLocal(1, 0);
      vertexIdx++;
    }

    // ========== CREATE VERTICES AND TRIANGLES ==========

    const triangulation = triangulationFn(steps);

    // In our triangulations i grows in the y direction, j in the z
    // direction and k in the x direction.
    triangulation.forEach((row, i) => {
      /** Is it time to draw edges and faces parallel to the y axis? */
      row.forEach((v, j) => {
        setVertexData(vtx(i, j), v, (j+i/2)/steps, i/steps);

        if (i > 0)          triangle((u, v) => vtx(i-1+u, j+v));
        if (i > 0 && j > 0) triangle((u, v) => vtx(i-u  , j-v));
      });
    });

    // ========== BUILD THE MESH ==========

    const vertexData = new B.VertexData();
    vertexData.positions = normals; // works since we are on the unit sphere
    if (smooth) {
      vertexData.normals = normals;
    }
    vertexData.uvs = uvs;
    vertexData.indices = indices;
    vertexData.applyToMesh(this);

    // ========== ADJACENT TRIANGLES ==========

    const renderAdjacent = (vtxFn: {
      border: (idx: number) => V3,
      sphere: (idx: number) => V3,
      cylinder: (idx: number) => V3,
    }) => {
      const positions = new Float32Array((2 * steps + 1) * 3);
      const normals = new Float32Array((2 * steps + 1) * 3);
      const indices = new Uint32Array(steps * 3);
      for (let j = 0; j <= steps; j++) {
        const v = vtxFn.border(j);
        normals[2*j*3 + 0] = positions[2*j*3 + 0] = v.x;
        normals[2*j*3 + 1] = positions[2*j*3 + 1] = v.y;
        normals[2*j*3 + 2] = positions[2*j*3 + 2] = v.z;
        if (j > 0) {
          const outer = vtxFn[adjShape](j-1);
          normals[(2*j - 1)*3 + 0] = positions[(2*j - 1)*3 + 0] = outer.x;
          normals[(2*j - 1)*3 + 1] = positions[(2*j - 1)*3 + 1] = outer.y;
          normals[(2*j - 1)*3 + 2] = positions[(2*j - 1)*3 + 2] = outer.z;
    
          indices[(j-1)*3 + 0] = 2*(j-1);
          indices[(j-1)*3 + 1] = 2*j;
          indices[(j-1)*3 + 2] = 2*j-1;
        }
      };

      const vertexData = new B.VertexData();
      vertexData.positions = positions;
      vertexData.normals = normals;
      vertexData.indices = indices;
      const mesh = new B.Mesh(name + "Adj", scene);
      vertexData.applyToMesh(mesh);
      mesh.material = adjacentMaterial;
      mesh.parent = this;
    }

    renderAdjacent({
      border: (idx: number) => triangulation[0][idx],
      sphere: (idx: number) => {
        const inner = triangulation[1][idx];
        return v3(inner.x, -inner.y, inner.z);
      },
      cylinder: (idx: number) => {
        const vtx = triangulation[0][idx];
        return v3(vtx.x, -1, vtx.z);
      },
    });
    renderAdjacent({
      border: (idx: number) => triangulation[idx][0],
      sphere: (idx: number) => {
        const inner = triangulation[idx][1];
        return v3(inner.x, inner.y, -inner.z);
      },
      cylinder: (idx: number) => {
        const vtx = triangulation[idx+1][0];
        return v3(vtx.x, vtx.y, -1);
      },
    });
    renderAdjacent({
      border: (idx: number) => triangulation[idx][steps-idx],
      sphere: (idx: number) => {
          const inner = triangulation[idx][steps-idx-1];
          return v3(-inner.x, inner.y, inner.z);
      },
      cylinder: (idx: number) => {
        const vtx = triangulation[idx][steps-idx];
        return v3(-1, vtx.y, vtx.z);
      },
    });
  }
}

const nSteps = M.observable.box(12);
const nStepsElem = document.querySelector("#nSteps") as HTMLInputElement;
Object.assign(nStepsElem, {min: 1, max: 40, value: nSteps.get()});
nStepsElem.addEventListener("change", () => {
  nSteps.set(Number.parseInt(nStepsElem.value));
});
const nStepsLabel = document.querySelector("label[for=nSteps]")!;
M.autorun(() => nStepsLabel.innerHTML = `# steps (${nSteps.get()})`);

const triangFn = M.observable.box("geodesics");
const triangFnElem = document.querySelector("#triangFn") as HTMLSelectElement;
triangFnElem.innerHTML =
  Object.keys(T.triangulationFns)
  .filter(name => name !== "collapsed")
  .map(name => `<option>${name}</option>`).join("\n");
triangFnElem.value = triangFn.get();
triangFnElem.addEventListener("change", () => {
  triangFn.set(triangFnElem.value);
});

type AdjacentShape = "sphere" | "cylinder";
const adjacentShape = M.observable.box<AdjacentShape>("sphere");
const adjacentShapeElem = document.querySelector("#adjacentShape") as HTMLSelectElement;
adjacentShapeElem.value = adjacentShape.get();
adjacentShapeElem.addEventListener("change", () => {
  adjacentShape.set(adjacentShapeElem.value as AdjacentShape);
});

const displayMode = M.observable.box("polyhedron");
const displayModeElem = document.querySelector("#displayMode") as HTMLSelectElement;
displayModeElem.value = displayMode.get();
displayModeElem.addEventListener("change", () => {
  displayMode.set(displayModeElem.value);
});

const color1 = M.observable.box("#ffffff");
const color1Elem = document.querySelector("#color1") as HTMLInputElement;
color1Elem.value = color1.get();
color1Elem.addEventListener("change", () => {
  color1.set(color1Elem.value);
});

const color2 = M.observable.box("#dddddd");
const color2Elem = document.querySelector("#color2") as HTMLInputElement;
color2Elem.value = color2.get();
color2Elem.addEventListener("change", () => {
  color2.set(color2Elem.value);
});

const slant1 = M.observable.box(0);
const slant1Elem = document.querySelector("#slant1") as HTMLInputElement;
Object.assign(slant1Elem, {min: -1, max: 1, step: .05, value: slant1.get()});
slant1Elem.addEventListener("change", () => {
  slant1.set(Number.parseFloat(slant1Elem.value));
});

const slant2 = M.observable.box(0);
const slant2Elem = document.querySelector("#slant2") as HTMLInputElement;
Object.assign(slant2Elem, {min: -1, max: 1, step: .05, value: slant2.get()});
slant2Elem.addEventListener("change", () => {
  slant2.set(Number.parseFloat(slant2Elem.value));
});

const slantsLabel = document.querySelector("#slantsLabel")!;
M.autorun(() => slantsLabel.innerHTML = `slants (${slant1.get()}, ${slant2.get()})`);


const checkers = new CheckeredTexture("checkers", 1024, {
  density: new B.Vector2(10, 10),
  offset: new B.Vector2(.2, .2),
}, scene);
M.autorun(() => checkers.slant = new B.Vector2(slant1.get(), slant2.get()));
M.autorun(() => checkers.color1 = B.Color4.FromHexString(color1.get()));
M.autorun(() => checkers.color2 = B.Color4.FromHexString(color2.get()));

function upd(t: number) {
  const o = t / 10000;
  checkers.offset = new B.Vector2(o, o);
  requestAnimationFrame(upd);
};
// requestAnimationFrame(upd);

let estMaterial = createStandardMaterial("mat", {
  diffuseColor: B.Color3.White(),
  diffuseTexture: checkers,
  specularColor: new B.Color3(.07, .07, .07),
}, scene);
M.autorun(() => {
  estMaterial.wireframe = displayMode.get() === "wireframe";
});

let est: EighthSphereTriangulation | undefined;
M.autorun(() => {
  est?.dispose();
  est = new EighthSphereTriangulation("est-mesh", {
    triangulationFn: T.triangulationFns[triangFn.get()],
    steps: nSteps.get(),
    smooth: M.computed(() => displayMode.get() !== "polyhedron").get(),
    adjShape: adjacentShape.get(),
  }, scene);
  est.material = estMaterial;
})


const forwardNeighborOffsets = [[1, -1], [1, 0], [0, 1]];

/**
 * Dihedral "bend" between triangles `p0 p1 p2` and `p0 p2 p3`,
 * that is, the supplementary angle to the dihedral angle.
 */
function dihedralBend(p0: V3, p1: V3, p2: V3, p3: V3) {
  const u01 = p1.subtract(p0);
  const u02 = p2.subtract(p0);
  const u03 = p3.subtract(p0);
  const n012 = u01.cross(u02).normalize();
  const n023 = u02.cross(u03).normalize();
  return Math.acos(n012.dot(n023));
}

type DihedralInfo = {bend: number, i: number, j: number, i_: number, j_: number};

let mostBentEdges: B.Mesh[] = [];
const mostBentEdgeMat = createStandardMaterial("mbeMat", {
  diffuseColor: B.Color3.Yellow(),
}, scene);

M.autorun(() => {
  const n = nSteps.get();
  const fn = triangFn.get();
  const adjCyl = adjacentShape.get() === "cylinder";
  const triangulation = T.triangulationFns[fn](n);
  let sum0 = 0, sum1 = 0, sum2 = 0;
  let min = 2 /* diameter of unit sphere */, max = 0;
  const dihedrals: DihedralInfo[] = [];

  triangulation.forEach((row, i) => {
    row.forEach((vtx, j) => {
      const k = n - i - j;
      forwardNeighborOffsets.forEach(([di, dj]) => {
        const i_ = i + di, j_ = j + dj, k_ = n - i_ - j_;
        if (i_ >= 0 && j_ >= 0 && k_ >= 0) {
          const v_ = triangulation[i_][j_];
          const u_ = v_.subtract(vtx);
          const d = u_.length();
          sum0++;
          sum1 += d;
          sum2 += d * d;
          min = Math.min(min, d);
          max = Math.max(max, d);

          {
            let va: V3, vb: V3;
            const ia = i + di + dj, ja = j - di     ;
            const ib = i      - dj, jb = j + di + dj;
            if (ib < 0) {
              va = triangulation[1][j];
              vb = adjCyl ? v3(vtx.x, -1, vtx.z) : v3(va.x, -va.y, va.z);
            } else if (ja < 0) {
              vb = triangulation[i][1];
              va = adjCyl ? v3(vtx.x, vtx.y, -1) : v3(vb.x, vb.y, -vb.z);
            } else if (ib + jb > n) {
              vb = triangulation[i][j-1];
              va = adjCyl ? v3(-1, vtx.y, vtx.z) : v3(-vb.x, vb.y, vb.z);
            } else {
              va = triangulation[ia][ja];
              vb = triangulation[ib][jb];
            }
            dihedrals.push({bend: dihedralBend(vtx, va, v_, vb), i, j, i_, j_});
          }
        }
      });
    });
  });

  const mean = sum1/sum0;
  const stdDev = Math.sqrt(sum2/sum0 - (sum1/sum0)**2);
  const stdDevInPercent = stdDev/mean*100;

  dihedrals.sort(({bend: bend1}, {bend: bend2}) => bend2 - bend1);
  console.log(n, fn, adjacentShape.get(),
    dihedrals.map(({bend, i, j, i_, j_}, rank) =>
      (rank === 0 || bend < dihedrals[rank-1].bend - 1e-7 ? "* " : "  ") +
      `${radToDeg(bend).toFixed(4)}° @` +
      ` ${i}:${j}:${n-i-j} - ${i_}:${j_}:${n-i_-j_}`
    ),
  );

  const maxBend = dihedrals[0].bend;
  mostBentEdges.forEach(e => e.dispose());
  mostBentEdges =
    displayMode.get() !== "wireframe" ? [] :
    dihedrals.filter(({bend}) => maxBend - bend < 1e-7)
    .map(({i, j, i_, j_}) => {
      const e = B.MeshBuilder.CreateTube("mostBentEdge", {
        path: [triangulation[i][j], triangulation[i_][j_]],
        tessellation: 6,
        radius: 0.01,
        cap: B.Mesh.CAP_ALL,
      }, scene);
      e.material = mostBentEdgeMat;
      return e;
    });

  // TODO Also analyze bends between pairs of triangles sharing only one vertex?

  let volume = 0;

  function addVol(a: V3, b: V3, c: V3) {
    volume += a.cross(b).dot(c) / 6;
  }

  triangulation.forEach((row, i) => {
    if (i > 0) {
      const prevRow = triangulation[i-1];
      row.forEach((v, j) => {
        addVol(v, prevRow[j+1], prevRow[j]);
        if (j > 0) {
          addVol(v, prevRow[j], row[j-1]);
        }
      });
    }
  });

  function show(where: string, what: string) {
    document.querySelector(where)!.innerHTML = what;
  }

  show("#nEdges", sum0.toFixed());
  show("#meanEdge", `${mean.toFixed(5)} ± ${stdDev.toFixed(5)} (±${stdDevInPercent.toFixed(3)}%)`);
  show("#minMax", `${min.toFixed(5)} : ${max.toFixed(5)} (1 : ${(max/min).toFixed(5)})`);
  show("#maxBend", radToDeg(maxBend).toFixed(4) + "°");
  // The volume as a percentage of the limit TAU/12 (= 1/8 of the volume of the
  // unit sphere):
  show("#volume", `${(volume / (TAU/12) * 100).toFixed(5)}% (gap: ${((1 - volume / (TAU/12)) * 100).toFixed(5)}%)`);
});

// Easter Egg
if (true) {
  const mat = new B.MultiMaterial("easterEggMat", scene);
  ["#ffffff", "#bb0000", "#3380ff"].forEach(color =>
    mat.subMaterials.push(
      createStandardMaterial("easterEgg" + color, {
        diffuseColor: B.Color3.FromHexString(color),
      }, scene),
    ),
  );

  const matIndices: Record<string, number[]> = {
    "#ff0000": [
      1,1,1,1,1,1,1,1,1,
        1,0,1,0,1,0,1,
          0,0,0,0,0,
            0,0,0,
              0,
    ],
    "#0000ff": [
      0,0,2,2,0,0,2,2,0,
        2,2,0,0,2,2,0,
          0,0,2,2,0,
            2,2,0,
              0,
    ],
  };

  let mesh: B.Mesh | undefined;

  M.autorun(() => {
    mesh?.dispose();

    const mats = matIndices[color1.get()];
    const dispMode = displayMode.get();
    if (
      mats &&
      nSteps.get() === 5 &&
      adjacentShape.get() === "cylinder" &&
      (dispMode === "polyhedron" || dispMode === "smooth")
    ) {
      let triangulation = T.triangulationFns[triangFn.get()](5);
      const positions = new Float32Array(21 * 3);
      const indices = new Uint32Array(25 * 3);
      let idx = 0, ii = 0;
      triangulation.forEach((row, i) => {
        row.forEach((vtx, j) => {
          positions[3*idx + 0] = vtx.x;
          positions[3*idx + 1] = vtx.y;
          positions[3*idx + 2] = vtx.z;
          if (i > 0) {
            if (j > 0) {
              indices[ii++] = idx;
              indices[ii++] = idx - 1;
              indices[ii++] = idx - 7 + i;
            }
            indices[ii++] = idx;
            indices[ii++] = idx - 7 + i;
            indices[ii++] = idx - 6 + i;
          }
          idx++;
        });
      });

      mesh = new B.Mesh("easterEgg", scene);
      Object.assign(new B.VertexData(), {
        positions,
        normals: dispMode === "smooth" ? positions : undefined,
        indices,
      }).applyToMesh(mesh);

      mesh.material = mat;
      mesh.subMeshes = [];
      mats.forEach((mat, idx) => {
        new B.SubMesh(mat, 0, positions.length, idx*3, 3, mesh!);
      });

      mesh.scaling = v3(1,-1, 1);
      mesh.position = v3(0,-1,0);
    }
  });
}

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
