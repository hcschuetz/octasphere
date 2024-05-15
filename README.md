Sub-Projects
------------

Sub-projects in this repository:
- A presentation on octasphere triangulations
  ([source](./presentation/),
  [slides](https://hcschuetz.github.io/octasphere/presentation/dist/))
- The "lab" project for experimenting with the triangulations
  ([source](./lab/), [web app](https://hcschuetz.github.io/octasphere/lab/dist/))

(Two former sub-projects that were not specifically about octaspheres
but rather about sphere texturing have been moved to
[their own repository](https://hcschuetz.github.io/sphere-texturing).)

Now for an explanation what this octasphere stuff is all about:


Triangulations of the Octasphere
================================

Sphere Triangulation
--------------------

In computer graphics triangle meshes for spheres
are frequently constructed as longitude/latitude grids
with added diagonals in each of the resulting quadrangles.
See for example
[here](https://threejs.org/docs/#api/en/geometries/SphereGeometry).

This approach has the advantage that it is easy to understand,
but it also has its disadvantages coming from the fact that the meridians
are much denser near the poles than near the equator:
- Textures are strongly distorted.
- Processing power is wasted for the many small triangles near the poles.
- Degenerate triangles around the poles can cause problems
  for geometric algorithms.

An alternative approach is to take a polyhedron (usually a regular one),
subdivide its faces into triangles, and then project the mesh to the sphere.

A popular choice is to start with a regular icosahedron,
which has various advantages:
- Each face is a regular triangle, which is easy to subdivide regularly
  into smaller triangles.
- A regular icosahedron already comes quite close to its circumscribed sphere
  (at least when compared to the other Platonic solids).
  Therefore a straight-forward central projection
  leads to a relatively small distortion.
- The vertices of an icosahedron have a degree of 5 and are thus close to the
  degree 6 of the auxiliary vertices introduced by the sub-triangulation.
  This is helpful for some geometric algorithms.

Spheres triangulated this way are sometimes called "icospheres".

Sphere triangulations based on a cube are also popular because the square
faces of a cube are easy to work with.


The Octasphere
--------------

Another possible choice is the "octasphere", a sphere triangulation based on
a regular octahedron, which has these advantages:
- As with the icosahedron, the faces are already triangles,
  making a subdivision easy.
- If we only map one of the octahedron faces to the circumscribing sphere,
  we get an eighth of that sphere.
  These eighths of spheres are useful
  because they occur as the corners of rounded boxes.

An "octasphere" is created like this:
- Start with a regular octahedron.
- Subdivide the 8 triangular faces into smaller triangles.
- Somehow map the vertices introduced by this sub-triangulation
  from the faces to a sphere.

We will discuss various such mappings and their properties.

In the demo and in the following considerations
we deal with only one of the faces
and the corresponding spherical triangle covering an eighth of the sphere.
The other faces are to be treated in an analogous way.

For simplicity we also assume
that the sphere is the unit sphere around the origin and
that our octahedron face has vertices at positions `ex = (1, 0, 0)`,
`ey = (0, 1, 0)`, and `ez = (0, 0, 1)`.
We generate triangulations of the corresponding eighth of the sphere.

Assume we want to subdivide each edge in `n` segments.
Then each vertex `(x, y, z)` of the triangulation has these properties:
- `x`, `y`, `z` are nonnegative integral multiples of `1/n`.
- `x + y + z = 1`.

The sub-triangulation of a face has various symmetries corresponding to
the permutations of the three corners of the face or, equivalently,
of the coordinate axes.
Some of these symmetries are shown in the demo.
The mappings from the face to the sphere discussed below
preserve more or less of these symmetries.

We can procedurally create the vertices like this:
```js
for (let j = 0; j <= n; j++) {
  for (let k = 0; k <= n - j; k++) {
    let i = n - j - k;
    const x = i/n;
    const y = j/n;
    const z = k/n;
    const position = (x, y, z);
    emitVertex(position);
  }
}
```
Due to the symmetries the loops can also be organized in various other ways.

Using the unit  vectors
```js
const ex = (1, 0, 0);
const ey = (0, 1, 0);
const ez = (0, 0, 1);
```
and the [`lerp` function](https://en.wikipedia.org/wiki/Linear_interpolation)
for linear interpolation we can also define `position` equivalently like this:
```js
    const position = lerp(lerp(ex, ey, y), lerp(ez, ey, y), z/(1-y));
```
or like this:
```js
    const position = lerp(lerp(ex, ez, z/(1-y)), ey, y);
```

Why would one do this?
Probably one wouldn't since the simple expression `(x, y, z)`
is more readable and more efficient.

I have just introduced these `lerp`-based expressions for comparison
with similar expressions below.


Geodesic Polyhedron
-------------------

The simplest mapping from the face to the sphere is a central projection.
That is, we just normalize the position vector of each vertex on the face,
giving a point on the sphere.
So we can calculate `position` as
```js
    const position = normalize((x, y, z));
```
or, equivalently, as
```js
    const position = normalize(lerp(lerp(ex, ey, y), lerp(ez, ey, y), z/(1-y)));
```
or, equivalently, as
```js
    const position = normalize(lerp(lerp(ex, ez, z/(1-y)), ey, y));
```
where `normalize(...)` returns a unit vector in the direction of its argument
vector.

Properties:
- The vertices on a straight line on the face are mapped to vertices
  on a geodesic of the sphere.  (Hence the name.)
- All the symmetries corresponding to axis permutations are kept.
- Triangles near the center of the face are mapped to large triangles
  on the sphere whereas triangles near the 3 corners of the face are mapped
  to smaller triangles on the sphere.
- Also the segments along the face's edges are mapped non-uniformly:
  Segments near the center of an edge become longer on the sphere than
  segments near the ends of the edge.

We often want a more uniform mapping.
In particular we want the edge segments to be mapped uniformly
so that in a rounded box the edge segments of the rounded corners
fit with the equispaced edge segments of the quarter cylinders
implementing the edges of the rounded box.

See [this Wikipedia article](https://en.wikipedia.org/wiki/Geodesic_polyhedron)
for more on geodesic polyhedra.


Equispaced Geodesics
--------------------

Instead of applying a linear interpolation followed by normalization
we can use
[spherical linear interpolation](https://en.wikipedia.org/wiki/Slerp)
to define the vertices on the sphere in a way similar to one of the formulas
above:
```js
    const position = slerp(slerp(ex, ey, y), slerp(ez, ey, y), z/(1-y));
```
Here the expressions `slerp(ex, ey, y)` and `slerp(ez, ey, y)` for
`y = 0, 1/n, 2/n, ..., 1` generate equispaced vertices along the arcs
from `ex` to `ey` and from `ez` to `ey`.
(We will consider `ey` as a "pole" of the sphere and accordingly
call the two adjacent arcs the "meridians".
The third arc from `ex` to `ez` will be called the "equator".)

The outer `slerp` connects pairs of corresponding vertices on the two meridians
with geodesics and puts equispaced vertices on these geodesics.
In particular the vertices `ex` and `ez` are connected in this way along the
equator.

Properties:
- All three arcs delimiting our eighth of the sphere
  (the two meridians and the equator) are divided into
  `n` segments of equal size.
- The symmetry between the `x` axis and the `z` axis is kept, but
  the other symmetries, especially the `±120°` rotations of the triangle,
  are broken.  That is, vertices inside the spherical triangle
  are generally not mapped to vertices by such rotations.
  (But vertices on the arcs delimiting our spherical
  triangle *are* mapped to vertices by the `±120°` rotations.)
- Intuitively, the vertices inside the spherical triangle are "too close to
  the pole `ey`".
  For example, the face center `(1/3, 1/3, 1/3)` is not mapped to the center
  `(sqrt(1/3), sqrt(1/3), sqrt(1/3)) ~ (0.577, 0.577, 0.577)`
  of the spherical triangle, but to
  `~ (0.548, 0.632, 0.548)`, which is closer to the "pole" `ey`.

See [this blog post](https://prideout.net/blog/octasphere/)
and [this tutorial](https://catlikecoding.com/unity/tutorials/procedural-meshes/geodesic-octasphere/) for more on
using equispaced geodesic octaspheres.


Parallels
---------

We can also use spherical linear interpolation in a way similar to the other
"`lerp`" formula above:
```js
    const position = slerp(slerp(ex, ez, z/(1-y)), ey, y);
```
The vertices for a given value of `y` are mapped to "parallels" of the equator,
that is, to lines of constant latitude.
Notice, however, that this is not the usual longitude/latitude construction of
a sphere, where all parallels are divided into the same number of segments.
In our current construction parallels closer to the equator are divided in more
segments and parallels closer to the pole are divided in fewer segments.

Properties:
- All three arcs delimiting our eighth of the sphere
  (the two meridians and the equator) are divided into
  `n` segments of equal size.
- The symmetry between the `x` axis and the `z` axis is kept, but
  the other symmetries, especially the `±120`° rotations of the triangle,
  are broken.  That is, vertices inside the spherical triangle
  are generally not mapped to vertices by such rotations.
  (But vertices on the arcs delimiting our spherical
  triangle *are* mapped to vertices by the `±120°` rotations.)
- Intuitively, the vertices inside the spherical triangle are "too close to
  the equator".
  For example, the face center `(1/3, 1/3, 1/3)` is not mapped to the center
  `(sqrt(1/3), sqrt(1/3), sqrt(1/3)) ~ (0.577, 0.577, 0.577)`
  of the spherical triangle, but to
  `~ (0.612, 1/2, 0.612)`, which is closer to the equator.

So the current construction breaks the same symmetries as the equispaced
geodesics above, but "in the opposite direction".


Sine-Based Mapping
------------------

While the two preceding constructions provide equispaced vertices along
the edges of the spherical triangle, their placement of inner vertices
feels unbalanced.  Mathematically this is reflected by the broken symmetries.

We now construct a mapping which
- provides equispaced vertices along the edges of the spherical triangle and
- places the vertices in a symmetric way.

Let us consider one edge of our octahedron face and the corresponding edge
of the spherical triangle, say the ones connecting `ex` and `ey`.
We want to map a uniform motion along the octahedron edge to a uniform
motion along the meridian.
Let the motion be from `ex` to `ey` driven by the parameter `t` ranging from
`0` to `1`.

The motion along the edge is given by the expression
```js
  (x, y, z) = (1 - t, t, 0)
```

The uniform motion along the meridian is given by the expression
```js
  (X, Y, Z) = (cos(t * 90°), sin(t * 90°), 0)
```

The coordinates `(X, Y, Z)` of the point on the meridian can be rewritten
using the coordinates `(x, y, z)` of the point on the octahedron edge:
```js
  X = cos(t * 90°) = sin(90° - t * 90°) = sin((1 - t) * 90°) = sin(x * 90°);
  Y = sin(t * 90°) = sin(y * 90°);
  Z = 0 = sin(0°) = sin(0 * 90°) = sin(z * 90°);
```
Taking this together, the meridian point has a very symmetric representation:
```js
  (X, Y, Z) = (sin(x * 90°), sin(y * 90°), sin(z * 90°))
```
The same expression can be derived for the other meridian and the equator.

Now there is no need to use the same expression
for the inner vertices of the face,
but it feels natural to do so.
Unfortunately this expression does not map inner vertices to the sphere
but to points inside the sphere.
For example the face center `(1/3, 1/3, 1/3)` is mapped to
`(sin(1/3 * 90°), sin(1/3 * 90°), sin(1/3 * 90°)) = (sin(30°), sin(30°), sin(30°)) = (1/2, 1/2, 1/2)`, which has a Euclidean norm of `sqrt(3)/2 < 1`.

As a "hack" we can simply apply a normalization as a second step after
the sine-based expression from above:
```js
  normalize((sin(x * 90°), sin(y * 90°), sin(z * 90°)))
```
This normalization does not affect the vertices on the edges because they
are already normalized.  So the equispacing along the edges is not broken.

Properties:
- All three arcs delimiting our eighth of the sphere
  (the two meridians and the equator) are divided into
  `n` segments of equal size.
- The symmetries from the octahedron face and the geodesic polyhedron
  are kept.
- The face center `(1/3, 1/3, 1/3)` is now mapped to the center
  `(sqrt(1/3), sqrt(1/3), sqrt(1/3)) ~ (0.577, 0.577, 0.577)`
  of the spherical triangle.
- Still, intuitively, the vertices on the sphere appear a bit too close
  to the edges, making the sub-triangles close to the center too large
  and the sub-triangles near the corners too small.
  Nevertheless the placement is far more uniform than
  with the geodesic-polyhedron approach described above.

Finally notice that we only need sine values for the `n+1` angles
`0°`, `1/n * 90°`, `2/n * 90°`, ..., `90°`.
We can pre-compute and tabulate these values so that no transcendental functions
need to be applied in the rest of the calculation.


Spherical Barycentric Coordinates
---------------------------------

We will now construct a mapping that is
- equispaced along the edges,
- symmetric with respect to all permutations of the three axes,
- therefore also mapping the face center to the center of the spherical
  triangle,
- and intuitively even more uniform than the "sine-based mapping"
  described above.

As a first step we will generalize the concept of
[barycentric coordinates](https://en.wikipedia.org/wiki/Barycentric_coordinate_system)
from the plane triangle constituting our octahedron face
to our spherical triangle.
(Note that various concepts of "spherical barycentric coordinates"
have already been introduced earlier in the literature.
How are those concepts related to the one introduced here?
And could we use those concepts as well?)

A point `(X, Y, Z)` in our spherical triangle can be identified by the three
angles between the point and each of the three coordinate planes:
```js
(ξ, υ, ζ) = (asin(X), asin(Y), asin(Z))
```
As we have only two degrees of freedom on the sphere, giving three angles
is actually redundant.
This is analogous to the usual flat barycentric coordinates.
Notice, however, that in contrast to the flat case,
the sum of the three angles is not constant.

We normalize the triplet of angles so that their sum becomes `1`:
```js
(x, y, z) = (ξ / s, υ / s, ζ / s)   where   s = ξ + υ + ζ
```
By construction we now have `x + y + z = 1`.
Furthermore for our initial point we had `X, Y, Z > 0`,
which implies `ξ, υ, ζ > 0`, then `s > 0`, and finally `x, y, z > 0`.
Therefore the point `(x, y, z)` is on our octahedron face.
`x`, `y`, and `z` are actually the (flat) barycentric coordinates of that point
in the face.

So we have defined a mapping from point `(X, Y, Z)` on the spherical triangle
to point `(x, y, z)` on the octahedron face.
This mapping is apparently very well-behaved.
So there is an inverse mapping from the face to the spherical triangle.

We use this inverse mapping to map the vertices of the face sub-triangulation
to the sphere.
The resulting triangulation has has some favorable properties:
- It has equispaced vertices along the meridians
  and the equator.
- It is symmetric with respect to axis permutations.
  (In particular it maps the center of the face
  to the center of the spherical triangle.)
- While any mapping from a plane to a sphere necessarily introduces some
  distortion, the distribution of vertices is quite uniform.

We have not given a constructive definition of the mapping from `(x, y, z)`
to `(X, Y, Z)` and I am afraid that this is not possible in a straight-forward
way.
But it is possible to give an iterative approximation algorithm, which
happens to converge very quickly:
```js
// barycentric normalization
function normalize1((x, y, z)) {
  const s = x + y + z;
  return (x / s, y / s, z / s);
}

// Euclidean normalization:
function normalize2((x, y, z)) {
  const len = sqrt(x**2 + y**2 + z**2);
  return (x / len, y / len, z / len);
}

function sphereToFace((X, Y, Z)) {
  return normalize1((asin(X), asin(Y), asin(Z)));
}

function faceToSphere((x, y, z)) {
  // Use the sine-based mapping as the initial guess:
  let guess = normalize2((sin(x * 90°), sin(y * 90°), sin(z * 90°)));
  while (true) {
    const f = sphereToFace(guess);
    const offset = f - (x, y, z);
    if (/* offset is small enough */) {
      return guess;
    }
    guess = normalize2(normalize1(guess) - offset);
  }
}
```


Balanced Placement
------------------

We can also place the vertices in the spherical triangle in such a way that
- the boundary vertices are equispaced along the delimiting arcs and
- each inner vertex is "centered" between its six neighbor vertices.

Let us call this placement "balanced".
It can be approximated iteratively like this:

> - Start with any vertex placement P<sub>0</sub> that evenly subdivides
>   the three sides of our spherical triangle.
> - For i = 0, 1, ...
>   - Compute a new placement P<sub>i+1</sub> from P<sub>i</sub> such that
>     - each inner vertex of P<sub>i+1</sub> is at the "center" of the
>       six neighbors of the corresponding vertex in P<sub>i</sub> and
>     - each boundary vertex of P<sub>i+1</sub> is at the same position
>       as the corresponding vertex in P<sub>i</sub>.
>   - Terminate when P<sub>i+1</sub> does not differ "significantly" from
>     P<sub>i</sub>.

Notes:
- The word "center" has been put in quotes above
  because the 3D mean of several points on the unit sphere
  will generally not be on the unit sphere but inside it.
  An ad-hoc solution is to perform a central projection, that is, to simply
  normalize the mean value of the neighbors.
  Alternatively, we could use some sphere-based definition of "center".
- The sequence of placements converges to the balanced placement
  and does not depend on the initial placement of the inner vertices in
  P<sub>0</sub>.
- Each iteration step preserves symmetries of the previous placement.
  The balanced placement is symmetric with respect to axis permutations.
- The balanced placement (or a good approximation) looks even more uniform
  than the placement based on spherical barycentric coordinates.


Octasphere: Summary
-------------------

Of the vertex placements investigated above I think one could use
- the geodesic-polyhedron mapping if simplicity is most important,
- the balanced placement if performance is not
  an issue (for example because the vertices are pre-computed for one or a few
  values of `n` and re-used in many sphere instances), and
- the sine-based approach as a good quality/performance compromise.

The equispaced-geodesics approach and the parallels approach
require more computation effort than the sine-based approach and
produce a less uniform and less symmetric vertex placement.
So these approaches would be recommended only if there is an
application-specific reason to use them.


Tetrasphere and Icosphere
-------------------------

It is mostly straight-forward to adapt the constructions given above to
a regular tetrahedron or a regular icosahedron, whose faces are also
equilateral triangles.

Computations are a bit simpler for the octahedron case because
- the octahedron vertices can be aligned with the coordinate axes and
- the angle between neighboring vertices is `90°`.

This made the derivation of the sine-based mapping particularly easy.
Transferring this to icospheres and tetraspheres would mean to extend the
[slerp formula](https://en.wikipedia.org/wiki/Slerp#Geometric_slerp)
from 2 to 3 base vertices.

One could argue
- that it does not make much sense to start with a tetrahedron, which is
  the least sphere-like among the Platonic solids, or
- that there is no need to use sophisticated mappings for icospheres
  because an icosahedron is already quite sphere-like.

It might, however, make sense to use tetraspheres
if the modelled objects (for example carbon atoms in chemistry)
have the respective symmetry.


Literature and Open Questions
-----------------------------

Geodesic polyhedra are well-known and even have their own Wikipedia article.
Equispaced geodesics are also known and I have provided two links above.

Have the other mappings already been suggested and investigated?
Some of them feel so natural that I could imagine that someone else has already
thought of them.
Or are there other approaches for triangulating an octasphere?
If you know of previous work, please let me know
[here](https://github.com/hcschuetz/octasphere/discussions/2).

Finally, I am not too happy with the names I am using for the sine-based mapping
and the mapping based on spherical barycentric coordinates.
Any ideas for better names?  Please give your suggestions
[here](https://github.com/hcschuetz/octasphere/discussions/1).
