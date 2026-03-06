# Miller Indices Visualizer

An interactive, 3D educational tool designed to help students and researchers visualize crystallographic planes and directions. Built with **React**, **Three.js**, and **Tailwind CSS**.

## 🚀 Live Demo

[Check out the live app here!](https://miller-indice-visualizer.vercel.app)

## ✨ Features

* **Dynamic 3D Rendering**: Rotate, zoom, and pan around crystal lattices to understand spatial relationships.

* **Support for All 7 Crystal Systems**: Cubic, Tetragonal, Orthorhombic, Rhombohedral, Hexagonal, Monoclinic, and Triclinic.

* **Miller-Bravais (4-Index) Support**: Specialized visualization for Hexagonal systems using $(h k i l)$ notation.

* **Real-time Lattice Manipulation**: Adjust lattice parameters ($a, b, c$) and inter-axial angles ($\alpha, \beta, \gamma$) with instant feedback.

* **Plane & Direction Toggle**: Switch between visualizing Miller planes and crystallographic directions.

* **Interactive Educational Quiz Mode**: 

    * **Identify:** Rotate the model to read absolute fractional intercepts and deduce the correct Miller indices.

    * **Draw Plane:** A free-form 3D sandbox. Define custom grid partitions for each specific axis, click to place nodes directly in 3D space, and construct physical planes. Features robust validation to accept any mathematically valid parallel plane.


## 🛠️ Tech Stack

* **Framework**: [React](https://react.dev/)

* **Build Tool**: [Vite](https://vitejs.dev/)

* **3D Engine**: [Three.js](https://threejs.org/)

* **Styling**: [Tailwind CSS](https://tailwindcss.com/)

* **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Installation & Local Development

To run this project on your local machine, follow these steps:

1. **Clone the repository:**

    ```bash
    git clone https://github.com/yunchimaxwelllo/Miller_Indice_Visualizer.git
    cd miller-indices-visualizer

    ```

2. **Install Dependencies:**

    ```bash 
    npm install
    ```

3. **Start the development server:**

    ```bash
    npm run dev
    ```

4. **Build for production:**

    ```bash
    enpm run build
    ```

## 📖 How It Works

**Plane and Direction Logic**

The visualizer calculates the fractional intersections of the plane with the unit cell axes based on the provided Miller indices. For negative indices, the tool automatically shifts the origin to ensure the plane is visible within the primary unit cell. Directions are rendered as vectors with dynamic clipping so they remain visually contained within the lattice bounds..

**Interactive Drawing & Parallel Validation**

In the "Draw Plane" quiz mode, the engine uses a Three.js raycaster to detect exact 3D clicks on dynamic grid nodes. When a user connects 3 or more points:

1. The app extracts non-collinear points to compute the Fractional Normal Vector of the user's custom shape.

2. It verifies all selected points are perfectly coplanar.

3. It calculates the Cross Product between the user's fractional normal and the target Miller indices. If the result is zero, the shape is verified as a perfectly parallel plane, teaching students that Miller indices represent infinite families of parallel planes, not just a single static shape.



## 📄 License

This project is open-source and available under the MIT License.

Created as an educational resource for Material Science and Solid State Physics.