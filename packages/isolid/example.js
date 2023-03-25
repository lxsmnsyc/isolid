import compile from './dist/esm/development/compiler.mjs'

// const code = `
// import { clientComponent$ } from 'isolid';

// const A = clientComponent$(() => (
//   <h1>{message()}</h1>
// ));
// const B = clientComponent$(() => (
//   <A />
// ));
// const C = clientComponent$(() => (
//   <B />
// ));
// `;
const code = `
import { clientComponent$ } from 'isolid';

const greeting = 'Hello';
const receiver = 'World';
const message = () => \`\${greeting}, \${receiver}!\`;

const C = clientComponent$(() => (
  <h1>{message()}</h1>
));
const D = clientComponent$(() => (
  <C />
));
`;

console.log('Input:');
console.log(code);

const result = await compile(
  'src/example.jsx',
  code,
  { mode: 'server' },
);
console.dir(result, {
  depth: null
});