# Miller Indices Visualizer

An interactive, 3D educational tool designed to help students and researchers visualize crystallographic planes and directions. Built with **React**, **Three.js**, and **Tailwind CSS**.

## 🚀 Live Demo

[Check out the live app here!](https://miller-indice-visualizer.vercel.app)

## ✨ Features

* **Dynamic 3D Rendering**: Rotate, zoom, and pan around crystal lattices to understand spatial relationships.

* **Support for All 7 Crystal Systems**: Cubic, Tetragonal, Orthorhombic, Rhombohedral, Hexagonal, Monoclinic, and Triclinic.

* **Miller-Bravais (4-Index) Support**: Specialized visualization for Hexagonal systems using $(h k i l)$ notation.

* **Real-time Lattice Manipulation**: Adjust lattice parameters ($a, b, c$) and inter-axial angles ($\alpha, \beta, \gamma$) with instant feedback.

* **Quiz Mode**: An educational mode that provides absolute intercept labels ($1/2 a, 1 b, \dots$) in 3D space.

* **Plane & Direction Toggle**: Switch between visualizing Miller planes and crystallographic directions.

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
    git clone https://github.com/YOUR_USERNAME/miller-indices-visualizer.git
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

**Plane Logic**

The visualizer calculates the intercepts of the plane with the unit cell axes based on the provided Miller indices $(h k l)$. For negative indices, the tool automatically shifts the origin to ensure the plane is visible within the primary unit cell.

**Direction Logic**

Directions $[u v w]$ are rendered as vectors starting from the origin. The tool includes logic to clip vectors so they remain visually contained within the lattice bounds.

## 📄 License

This project is open-source and available under the MIT License.

Created as an educational resource for Material Science and Solid State Physics.