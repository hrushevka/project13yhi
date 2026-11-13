import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_lightMode;

float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
}

vec2 hash2(float n) {
    return fract(sin(vec2(n, n + 1.0)) * vec2(43758.5453123, 22578.1459123));
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    vec3 darkCosmos = vec3(0.082, 0.125, 0.169);
    vec3 darkNavy = vec3(0.176, 0.267, 0.337);
    vec3 darkSage = vec3(0.455, 0.467, 0.424);
    vec3 darkCream = vec3(0.992, 0.843, 0.651);
    vec3 darkTerra = vec3(0.620, 0.404, 0.322);

    vec3 lightAlabaster = vec3(0.965, 0.945, 0.906);
    vec3 lightLinen = vec3(0.925, 0.890, 0.824);
    vec3 lightPeach = vec3(0.957, 0.796, 0.620);
    vec3 lightSienna = vec3(0.765, 0.486, 0.388);
    vec3 lightSage = vec3(0.545, 0.588, 0.525);
    vec3 lightSlate = vec3(0.345, 0.463, 0.549);

    vec3 baseDark = mix(darkCosmos, darkNavy, 0.42 * uv.y + 0.15 * (1.0 - uv.x));
    vec3 baseLight = mix(lightAlabaster, lightLinen, 0.35 * (1.0 - uv.y) + 0.15 * uv.x);
    vec3 color = mix(baseDark, baseLight, u_lightMode);

    for (int i = 0; i < 14; i++) {
        float fi = float(i) + 1.0;
        vec2 seed = hash2(fi * 19.37);
        vec2 center = (seed - 0.5) * vec2(aspect * 1.15, 1.05);

        center += 0.06 * vec2(
            sin(u_time * 0.11 + fi * 1.7),
            cos(u_time * 0.09 + fi * 2.3)
        );

        float speed = 0.26 + 0.22 * hash1(fi * 7.13);
        float phase = fi * 2.41 + hash1(fi * 3.91) * 6.2831;
        float pulse = 0.5 + 0.5 * sin(u_time * speed + phase);
        pulse = smoothstep(0.28, 0.96, pulse);

        float radius = 0.18 + 0.16 * hash1(fi * 11.7);
        float d = length(p - center);
        float softDot = exp(-(d * d) / (radius * radius));

        float selector = hash1(fi * 5.3);

        vec3 dotColorDark = mix(darkNavy, darkTerra, selector * 0.65);
        dotColorDark = mix(dotColorDark, mix(darkCream, darkSage, hash1(fi * 2.9)), 0.35);

        vec3 dotColorLight = mix(lightPeach, lightSienna, selector);
        dotColorLight = mix(dotColorLight, mix(lightSage, lightSlate, hash1(fi * 2.9)), 0.42);

        vec3 dotCol = mix(dotColorDark, dotColorLight, u_lightMode);
        float intensity = mix(0.075, 0.075, u_lightMode);

        color = mix(color, dotCol, softDot * pulse * intensity);
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

interface ShaderBackgroundProps {
    theme?: 'dark' | 'light';
}

export function ShaderBackground({ theme = 'dark' }: ShaderBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const themeRef = useRef<'dark' | 'light'>(theme);

    useEffect(() => {
        themeRef.current = theme;
    }, [theme]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const compileShader = (type: number, source: string) => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vs || !fs) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );

        const posLoc = gl.getAttribLocation(program, 'a_position');
        const resLoc = gl.getUniformLocation(program, 'u_resolution');
        const timeLoc = gl.getUniformLocation(program, 'u_time');
        const lightModeLoc = gl.getUniformLocation(program, 'u_lightMode');

        let animationFrameId = 0;
        const startTime = performance.now();

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
            const width = Math.floor(window.innerWidth * dpr);
            const height = Math.floor(window.innerHeight * dpr);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
        };

        resize();
        window.addEventListener('resize', resize);

        const render = (now: number) => {
            const elapsed = (now - startTime) * 0.001;
            gl.useProgram(program);
            gl.enableVertexAttribArray(posLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            gl.uniform2f(resLoc, canvas.width, canvas.height);
            gl.uniform1f(timeLoc, elapsed);
            gl.uniform1f(lightModeLoc, themeRef.current === 'light' ? 1.0 : 0.0);

            gl.drawArrays(gl.TRIANGLES, 0, 6);
            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 0,
                pointerEvents: 'none',
                display: 'block',
            }}
        />
    );
}
