// src/simulation/ProceduralWorldGenerator.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getCurrentConfig } from '../config/ConfigManager.js';
import AssetLoader from '../utils/AssetLoader.js'; // Might need later for prop models

// Placeholder for noise function - you'd typically import this
// import { createNoise2D } from 'simplex-noise'; // Example import
// const noise = createNoise2D(Math.random); // Use a seed from config maybe
const noise = { // Simple placeholder noise function
    simplex2: (x, y) => (Math.sin(x * 0.1) + Math.cos(y * 0.1)) * 0.5 + 0.5 // Basic periodic noise
};


class ProceduralWorldGenerator {
    constructor(renderer, physicsEngine) {
        this.renderer = renderer; // THREE.Scene accessible via engine.renderer.scene
        this.physicsEngine = physicsEngine; // CANNON.World accessible via engine.physicsEngine.world
        this.config = getCurrentConfig();
        this.terrainData = null; // Store height data if needed for placement
        this.terrainSize = 300; // Size of the terrain plane
        this.terrainSegments = 64; // Number of segments (resolution) - affects performance

        if (this.config.DEBUG_MODE) {
            console.log("ProceduralWorldGenerator: Initialized");
        }
    }

    async generate() {
        console.log("ProceduralWorldGenerator: Generating world...");
        await this.generateTerrain(); // Make async if terrain loading becomes async
        this.placeProps(); // Place placeholder props
        this.placeGates(); // Place racing gates
        console.log("ProceduralWorldGenerator: World generation complete.");
    }

    // --- Terrain ---
    async generateTerrain() { // Changed to async just in case
        const terrainGeometry = new THREE.PlaneGeometry(
            this.terrainSize,    // Corresponds to X dimension initially
            this.terrainSize,    // Corresponds to Y dimension initially
            this.terrainSegments,
            this.terrainSegments
        );
        const terrainMaterial = new THREE.MeshStandardMaterial({
            color: "#678866", // Greenish-brown
            // wireframe: true, // Set to true for debugging terrain mesh
            wireframe: false, // Set to false for normal viewing
            side: THREE.DoubleSide, // Needed if camera goes below 0
            roughness: 0.9,
            metalness: 0.1,
        });

        const heightScale = this.config.WORLD_GENERATION.terrainHeightScale || 8;
        const noiseScale = this.config.WORLD_GENERATION.terrainNoiseScale || 0.05;

        const vertices = terrainGeometry.attributes.position.array;
        const heightData = []; // Dimensions: [segments + 1][segments + 1]

        let minHeight = Infinity;
        let maxHeight = -Infinity;

        // Verify loop boundaries and indexing (seems correct: 0 to segments inclusive = segments+1 points)
        for (let i = 0; i <= this.terrainSegments; i++) {
            heightData.push([]);
            const progressZ = i / this.terrainSegments;
            for (let j = 0; j <= this.terrainSegments; j++) {
                const progressX = j / this.terrainSegments;
                const x = (progressX - 0.5) * this.terrainSize;
                const z = (progressZ - 0.5) * this.terrainSize;
                const noiseVal = noise.simplex2(x * noiseScale, z * noiseScale);
                const height = noiseVal * heightScale;
                const vertexIndex = (i * (this.terrainSegments + 1) + j) * 3;

                if (!isNaN(height)) {
                    vertices[vertexIndex + 2] = height; // Apply height to Z before rotation
                    heightData[i][j] = height; // Store height data[z][x]
                    minHeight = Math.min(minHeight, height);
                    maxHeight = Math.max(maxHeight, height);
                } else {
                    console.error(`NaN height at i=${i}, j=${j}`);
                    vertices[vertexIndex + 2] = 0;
                    heightData[i][j] = 0;
                }
            }
        }
        this.terrainData = heightData;

        terrainGeometry.attributes.position.needsUpdate = true;
        terrainGeometry.rotateX(-Math.PI / 2); // Rotate geometry
        terrainGeometry.computeVertexNormals(); // Compute normals AFTER rotation

        if (this.config.DEBUG_MODE) {
            console.log(`Generated Terrain Heights - Min: ${minHeight.toFixed(2)}, Max: ${maxHeight.toFixed(2)}`);
        }

        const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
        terrainMesh.position.y = 0; // Set visual position
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = false;
        this.renderer.addObject(terrainMesh); // Add visual mesh

        if (this.config.DEBUG_MODE) {
            console.log("Terrain Mesh Transform:", {position: terrainMesh.position, rotation: terrainMesh.rotation});
        }

        // --- Physics Heightfield ---
        // Recalculate elementSize explicitly: Size / Number of Intervals (Segments)
        const elementSize = this.terrainSize / this.terrainSegments;

        // Ensure heightData is valid
        if (!heightData || heightData.length === 0 || !heightData[0] || heightData.length !== this.terrainSegments + 1 || heightData[0].length !== this.terrainSegments + 1) {
            console.error("ProceduralWorldGenerator: Invalid heightData dimensions for Heightfield!", heightData?.length, heightData?.[0]?.length);
            return; // Stop if data is bad
        }
        if (isNaN(elementSize) || elementSize <= 0) {
            console.error("ProceduralWorldGenerator: Invalid elementSize for Heightfield!", elementSize);
            return; // Stop if size is bad
        }


        const heightfieldShape = new CANNON.Heightfield(heightData, {
            elementSize: elementSize,
        });


        const terrainBody = new CANNON.Body({
            mass: 0, // Static
            position: new CANNON.Vec3(0, 0, 0), // Body at origin
        });
        terrainBody.material = this.physicsEngine.getMaterial('ground'); // Assign material AFTER creation;
        const rotation1Axis = new CANNON.Vec3(0, 0, 1); // World Y
        const rotation1Angle = -Math.PI/2; // 45 degrees in radians
        const rotation1Quat = new CANNON.Quaternion();
        rotation1Quat.setFromAxisAngle(rotation1Axis, rotation1Angle);

        const rotation2AxisLocal = new CANNON.Vec3(1, 0, 0); // Local X
        const rotation2Angle = -Math.PI / 2; // -90 degrees
        const rotation2Quat = new CANNON.Quaternion();
        rotation2Quat.setFromAxisAngle(rotation2AxisLocal, rotation2Angle);

        const finalQuat = new CANNON.Quaternion();
        rotation2Quat.mult(rotation1Quat, terrainBody.quaternion); // finalQuat = rotation2 * rotation1

        // Calculate offset to center the shape relative to the body's origin (0,0,0)
        const shapeOffset = new CANNON.Vec3(
            -this.terrainSize / 2,
            -this.terrainSize / 2,
            0,
        );
        terrainBody.addShape(heightfieldShape, shapeOffset); // Add shape with offset

        // Add body to physics engine AND provide the visual link
        this.physicsEngine.addBody(terrainBody, terrainMesh); // <<< PASS VISUAL MESH HERE

        if (this.config.DEBUG_MODE) {
            console.log(`ProceduralWorldGenerator: Terrain physics added. ElementSize: ${elementSize.toFixed(3)}`);
            console.log("Physics Body Position:", terrainBody.position);
            console.log("Physics Shape Offset:", shapeOffset);
        }
    }

    // Helper to get approximate terrain height at world coordinates (x, z)
    getTerrainHeight(x, z) {
        if (!this.terrainData) return 0;

        // Convert world coordinates (center is 0,0) to heightData array indices (origin is 0,0)
        // Range goes from [-terrainSize/2, terrainSize/2] -> [0, terrainSegments]
        const jFloat = (x / this.terrainSize + 0.5) * this.terrainSegments; // Map x to j index
        const iFloat = (z / this.terrainSize + 0.5) * this.terrainSegments; // Map z to i index

        // Clamp indices to valid range [0, terrainSegments]
        const i = Math.max(0, Math.min(this.terrainSegments, Math.floor(iFloat)));
        const j = Math.max(0, Math.min(this.terrainSegments, Math.floor(jFloat)));

        // Check if indices point outside the actually populated data ( <= segments)
        if (i >= this.terrainData.length || j >= this.terrainData[i].length) {
            // This might happen at the very edge due to float precision or if segments+1 logic differs elsewhere
            // Try clamping to the last valid index
            const clampedI = Math.min(i, this.terrainData.length - 1);
            const clampedJ = Math.min(j, this.terrainData[0].length - 1); // Assuming rectangular array
            if (clampedI >= 0 && clampedJ >= 0) {
                // Optionally log this edge case
                // console.warn(`getTerrainHeight: Clamping indices (${i}, ${j}) to (${clampedI}, ${clampedJ}) for coords (${x.toFixed(2)}, ${z.toFixed(2)})`);
                return this.terrainData[clampedI][clampedJ];
            }
            // console.warn(`getTerrainHeight: Indices (${i}, ${j}) out of bounds [${this.terrainData.length}, ${this.terrainData[0]?.length}] for coords (${x.toFixed(2)}, ${z.toFixed(2)})`);
            return 0; // Outside terrain data bounds after clamping attempt
        }


        // Simple nearest neighbor for now (using floor)
        // For smoother results, implement bilinear interpolation using iFloat, jFloat and the 4 surrounding points (i,j), (i+1,j), (i,j+1), (i+1,j+1)
        // Check neighbors exist before accessing them in interpolation!
        return this.terrainData[i][j]; // Return height from the grid data[z][x]
    }

    // --- Prop Placement ---
    placeProps() {
        const propCount = Math.floor((this.terrainSize * this.terrainSize) * (this.config.WORLD_GENERATION.propDensity || 0.005));
        if (this.config.DEBUG_MODE) console.log(`ProceduralWorldGenerator: Placing ${propCount} props...`);

        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8 });
        const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });

        for (let i = 0; i < propCount; i++) {
            const randX = (Math.random() - 0.5) * this.terrainSize * 0.95; // Avoid edges slightly
            const randZ = (Math.random() - 0.5) * this.terrainSize * 0.95;
            const terrainHeight = this.getTerrainHeight(randX, randZ); // Use updated getter

            // Simple check: Don't place props underwater (assuming water level near 0)
            // Adjust threshold based on expected minHeight
            if (terrainHeight < 0.2) continue;

            const isTree = Math.random() > 0.3; // 70% chance of tree

            if (isTree) {
                // Tree Placeholder (Cone)
                const height = Math.random() * 4 + 3; // 3m to 7m tall
                const radius = height * 0.2;
                const visualGeo = new THREE.ConeGeometry(radius, height, 8);
                const visualMesh = new THREE.Mesh(visualGeo, treeMaterial);
                // Position base slightly above terrain height to avoid z-fighting
                visualMesh.position.set(randX, terrainHeight + height / 2, randZ);
                visualMesh.castShadow = true;
                visualMesh.receiveShadow = true;
                this.renderer.addObject(visualMesh);

                // Physics Placeholder (Cylinder) - CANNON Cylinder axis is Y
                const physicsShape = new CANNON.Cylinder(radius * 0.5, radius * 0.5, height, 8); // Simpler physics shape (trunk)
                const physicsBody = new CANNON.Body({
                    mass: 0, // Static
                    material: this.physicsEngine.getMaterial('default'),
                    // Position physics body center to match visual center
                    position: new CANNON.Vec3(randX, terrainHeight + height / 2, randZ)
                });
                // Cylinder shape needs no local offset if body position is its center
                physicsBody.addShape(physicsShape);
                this.physicsEngine.addBody(physicsBody);

            } else {
                // Rock Placeholder (Icosahedron)
                const radius = Math.random() * 0.5 + 0.3; // 0.3m to 0.8m radius
                const visualGeo = new THREE.IcosahedronGeometry(radius, 1); // Low detail
                const visualMesh = new THREE.Mesh(visualGeo, rockMaterial);
                // Position slightly above terrain height
                visualMesh.position.set(randX, terrainHeight + radius * 0.5, randZ);
                visualMesh.castShadow = true;
                visualMesh.receiveShadow = true;
                this.renderer.addObject(visualMesh);

                // Physics Placeholder (Sphere)
                const physicsShape = new CANNON.Sphere(radius);
                const physicsBody = new CANNON.Body({
                    mass: 0, // Static
                    material: this.physicsEngine.getMaterial('default'),
                    // Position physics body center to match visual center
                    position: new CANNON.Vec3(randX, terrainHeight + radius * 0.5, randZ)
                });
                // Sphere shape needs no local offset if body position is its center
                physicsBody.addShape(physicsShape);
                this.physicsEngine.addBody(physicsBody);
            }
        }
        if (this.config.DEBUG_MODE) console.log(`ProceduralWorldGenerator: Finished placing props.`);
    }

    // --- Gate Placement ---
    placeGates() {
        const gateCount = this.config.WORLD_GENERATION.gateCount || 5;
        if (this.config.DEBUG_MODE) console.log(`ProceduralWorldGenerator: Placing ${gateCount} gates...`);

        for (let i = 0; i < gateCount; i++) {
            // Simple random placement for now
            const randX = (Math.random() - 0.5) * this.terrainSize * 0.8; // Keep gates away from far edges
            const randZ = (Math.random() - 0.5) * this.terrainSize * 0.8;
            const terrainHeight = this.getTerrainHeight(randX, randZ); // Use updated getter
            const randomRotationY = Math.random() * Math.PI * 2; // Random orientation

            const gateSize = { width: 4 + Math.random() * 2, height: 2.5 + Math.random(), depth: 0.2 };
            // Position gate base at terrain height
            const gatePosition = { x: randX, y: terrainHeight, z: randZ };

            this.createObstacle_Gate(gatePosition, gateSize, randomRotationY);
        }
        if (this.config.DEBUG_MODE) console.log(`ProceduralWorldGenerator: Finished placing gates.`);
    }

    // --- Gate Creation Logic (Seems OK, uses absolute positions) ---
    createObstacle_Gate(position, size = { width: 4, height: 2.5, depth: 0.2 }, rotationY = 0) {
        const { width, height, depth } = size;
        const pillarHeight = height;
        const pillarWidth = depth * 2; // Make pillars a bit thicker relative to depth
        const topBarWidth = width;
        const topBarHeight = depth * 2;

        // --- Visuals (Group multiple meshes) ---
        const gateGroup = new THREE.Group();
        // Set group position slightly above ground to avoid z-fighting if terrain is perfectly flat here
        gateGroup.position.set(position.x, position.y + 0.01, position.z);
        gateGroup.rotation.y = rotationY; // Set group rotation

        const material = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7, metalness: 0.2 });

        const pillarGeo = new THREE.BoxGeometry(pillarWidth, pillarHeight, depth);

        // Left Pillar
        const leftPillarMesh = new THREE.Mesh(pillarGeo, material);
        // Relative position within group (center pillar base at y=0 relative to group)
        leftPillarMesh.position.set(-width / 2 + pillarWidth / 2, pillarHeight / 2, 0);
        leftPillarMesh.castShadow = true; leftPillarMesh.receiveShadow = true;
        gateGroup.add(leftPillarMesh);

        // Right Pillar
        const rightPillarMesh = new THREE.Mesh(pillarGeo, material);
        rightPillarMesh.position.set(width / 2 - pillarWidth / 2, pillarHeight / 2, 0); // Relative position
        rightPillarMesh.castShadow = true; rightPillarMesh.receiveShadow = true;
        gateGroup.add(rightPillarMesh);

        // Top Bar
        const topBarGeo = new THREE.BoxGeometry(topBarWidth, topBarHeight, depth);
        const topBarMesh = new THREE.Mesh(topBarGeo, material);
        // Relative position (top bar sits exactly on top of pillars)
        topBarMesh.position.set(0, pillarHeight - topBarHeight / 2, 0); // Corrected Y position
        topBarMesh.castShadow = true; topBarMesh.receiveShadow = true;
        gateGroup.add(topBarMesh);

        this.renderer.addObject(gateGroup); // Add the whole group

        // --- Physics (Compound Body) ---
        const gateBody = new CANNON.Body({
            mass: 0, // Static
            // Set physics body base position to match visual group base position
            position: new CANNON.Vec3(position.x, position.y, position.z),
            material: this.physicsEngine.getMaterial('default')
        });
        gateBody.quaternion.setFromEuler(0, rotationY, 0); // Set body rotation to match visual group

        // Define shapes relative to the body's origin (which is at position.x, y, z)
        // Use half-extents for CANNON.Box
        const halfPillarW = pillarWidth / 2;
        const halfPillarH = pillarHeight / 2;
        const halfDepth = depth / 2;
        const halfTopBarW = topBarWidth / 2;
        const halfTopBarH = topBarHeight / 2;

        // Left Pillar Shape (Offset relative to body origin at base)
        const leftPillarShape = new CANNON.Box(new CANNON.Vec3(halfPillarW, halfPillarH, halfDepth));
        const leftPillarOffset = new CANNON.Vec3(-width / 2 + halfPillarW, halfPillarH, 0); // Center of pillar relative to body base
        gateBody.addShape(leftPillarShape, leftPillarOffset);

        // Right Pillar Shape
        const rightPillarShape = new CANNON.Box(new CANNON.Vec3(halfPillarW, halfPillarH, halfDepth));
        const rightPillarOffset = new CANNON.Vec3(width / 2 - halfPillarW, halfPillarH, 0);
        gateBody.addShape(rightPillarShape, rightPillarOffset);

        // Top Bar Shape
        const topBarShape = new CANNON.Box(new CANNON.Vec3(halfTopBarW, halfTopBarH, halfDepth));
        // Center of top bar relative to body base
        const topBarOffset = new CANNON.Vec3(0, pillarHeight - halfTopBarH, 0); // Corrected Y offset
        gateBody.addShape(topBarShape, topBarOffset);

        this.physicsEngine.addBody(gateBody);
    }

    // --- Cleanup (Optional) ---
    dispose() {
        // TODO: Implement cleanup by tracking added objects (meshes, bodies)
        // and removing them from the scene and physics world.
        console.log("ProceduralWorldGenerator: Disposing generated world (placeholder).");
    }
}

export default ProceduralWorldGenerator;