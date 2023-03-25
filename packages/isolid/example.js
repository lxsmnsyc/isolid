import compile from 'isolid/compiler'
import path from 'path';

// const code = `
// import { clientComponent$ } from 'isolid';
// import A from './A';

// function Example() {
//   const greeting = 'Hello';
//   const receiver = 'World';
  
//   const message = \`\${greeting}, \${receiver}!\`;

//   const IslandA = clientComponent$(() => <A>{message}</A>);
//   const IslandB = clientComponent$(() => <B>{message}</B>);
// }
// `;
const code = `
import { clientComponent$ } from 'isolid';
const greeting = 'Hello';
const receiver = 'World';

const message = () => \`\${greeting}, \${receiver}!\`;

const Example = clientComponent$(() => (
  <h1>{message()}</h1>
));
`;

console.log('Input:');
console.log(code);

const result = await compile(
  'src/example.tsx',
  code,
  { mode: 'server' },
);
console.dir(result, {
  depth: null
});