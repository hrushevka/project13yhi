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

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p *= 2.02;
        amp *= 0.5;
    }
    return value;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

    float t = u_time * 0.14;

    vec2 q = vec2(
        fbm(p * 1.6 + vec2(0.0, t)),
        fbm(p * 1.6 + vec2(5.2, -t * 0.8))
    );

    vec2 r = vec2(
        fbm(p * 2.1 + 2.8 * q + vec2(1.7, 9.2) + 0.15 * t),
        fbm(p * 2.1 + 2.8 * q + vec2(8.3, 2.8) - 0.12 * t)
    );

    float f = fbm(p * 1.8 + 2.2 * r);

    vec3 colDark = vec3(0.145, 0.145, 0.169);
    vec3 colTeal = vec3(0.322, 0.541, 0.604);
    vec3 colLight = vec3(0.851, 0.906, 0.910);

    float waveRibbon = smoothstep(0.32, 0.78, f);
    float highlight = smoothstep(0.66, 0.95, f * length(q));

    vec3 color = mix(colDark, colTeal * 0.58 + colDark * 0.42, waveRibbon);
    color = mix(color, colTeal, smoothstep(0.45, 0.85, r.x * f));
    color = mix(color, colLight * 0.78 + colTeal * 0.22, highlight * 0.45);

    float vignette = smoothstep(1.35, 0.25, length(p));
    color = mix(colDark * 0.92, color, vignette);

    gl_FragColor = vec4(color, 1.0);
}
`;

export function ShaderBackground() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
