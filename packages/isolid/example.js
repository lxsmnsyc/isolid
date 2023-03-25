import { split } from './dist/esm/development/compiler.mjs'

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
const code = `import { serverComponent$, clientComponent$ } from 'isolid';
const greeting = 'Hello';
const receiver = 'World';
const message = () => \`\${greeting}, \${receiver}!\`;
const C = serverComponent$(() => (
  <h1>{message()}</h1>
));
const D = clientComponent$(() => (
  <C />
));
`;

console.log('Input:');
console.log(code);

const result = await split(
  'src/example.jsx',
  code,
  { mode: 'client' },
);
console.log('Output:');
console.log(result.code);
console.log('Files:');
console.log(result.files);
console.log('Clients:');
console.log(result.clients);