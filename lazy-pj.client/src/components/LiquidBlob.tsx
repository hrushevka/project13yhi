import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
    float t = u_time * 0.85;
    float d = length(p) - 0.64;

    vec3 p1 = p - vec3(sin(t * 1.1) * 0.28, cos(t * 0.9) * 0.24, sin(t * 0.7) * 0.18);
    float b1 = length(p1) - 0.38;

    vec3 p2 = p - vec3(cos(t * 0.8) * -0.26, sin(t * 1.3) * 0.25, cos(t * 1.1) * 0.16);
    float b2 = length(p2) - 0.34;

    float m = smin(d, b1, 0.32);
    m = smin(m, b2, 0.32);
    m += 0.035 * sin(p.x * 8.0 + t * 2.0) * cos(p.y * 8.0 - t * 1.6);
    return m;
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.002, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

void main() {
    vec2 p = v_uv * 2.0 - 1.0;
    vec3 ro = vec3(0.0, 0.0, 2.35);
    vec3 rd = normalize(vec3(p, -1.6));

    float t = 0.0;
    bool hit = false;
    vec3 pos;

    for (int i = 0; i < 42; i++) {
        pos = ro + rd * t;
        float d = map(pos);
        if (d < 0.002) {
            hit = true;
            break;
        }
        if (t > 4.0) break;
        t += d * 0.85;
    }

    vec3 colDark = vec3(0.145, 0.145, 0.169);
    vec3 colTeal = vec3(0.322, 0.541, 0.604);
    vec3 colLight = vec3(0.851, 0.906, 0.910);

    if (!hit) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    vec3 n = calcNormal(pos);
    vec3 lightDir1 = normalize(vec3(0.7, 0.8, 1.0));
    vec3 lightDir2 = normalize(vec3(-0.8, -0.5, 0.6));

    float diff1 = max(dot(n, lightDir1), 0.0);
    float diff2 = max(dot(n, lightDir2), 0.0);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
    float spec = pow(max(dot(reflect(-lightDir1, n), -rd), 0.0), 24.0);

    vec3 base = mix(colDark, colTeal, diff1 * 0.85 + diff2 * 0.35);
    vec3 finalColor = mix(base, colLight, fresnel * 0.72 + spec * 0.68);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface LiquidBlobProps {
    size?: number;
}

export function LiquidBlob({ size = 56 }: LiquidBlobProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
        if (!gl) return;

        const compile = (type: number, src: string) => {
            const s = gl.createShader(type);
            if (!s) return null;
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                gl.deleteShader(s);
                return null;
            }
            return s;
        };

        const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        if (!vs || !fs) return;

        const program = gl.createProgram();
        if (!program) return;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW
        );

        const posLoc = gl.getAttribLocation(program, 'a_position');
        const timeLoc = gl.getUniformLocation(program, 'u_time');

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);

        let raf = 0;
        const start = performance.now();

        const draw = (now: number) => {
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.useProgram(program);
            gl.enableVertexAttribArray(posLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
            gl.uniform1f(timeLoc, (now - start) * 0.001);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            raf = requestAnimationFrame(draw);
        };

        raf = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(raf);
    }, [size]);

    return (
        <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
        />
    );
}
