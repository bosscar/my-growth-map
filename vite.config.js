import { defineConfig } from 'vite';

export default defineConfig({
    // Set the base path to your repo name if hosting on GitHub Pages
    // Example: if your repo is 'my-grwth-map', set this to '/my-grwth-map/'
    // If hosting on a custom domain or as username.github.io, use '/'
    base: './',
    build: {
        outDir: 'dist',
    }
});
