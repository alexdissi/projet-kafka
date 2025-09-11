const {
    busySpin,
    cpuHashSha256,
    sortLargeArrays,
    matMul,
    sieveCountPrimes,
    holdMegabytes
} = require('./performance-benchmarks');

console.log('=== Tests de Performance ===\n');

// Test 1: CPU baseline
console.log('1. Test busySpin (500ms)...');
const start1 = Date.now();
busySpin(500);
console.log(`   Durée: ${Date.now() - start1}ms\n`);

// Test 2: Hachage SHA-256
console.log('2. Test cpuHashSha256 (1000ms, 10KB)...');
const start2 = Date.now();
cpuHashSha256(1000, 10);
console.log(`   Durée: ${Date.now() - start2}ms\n`);

// Test 3: Tri de tableaux
console.log('3. Test sortLargeArrays (5 tableaux de 100k éléments)...');
const start3 = Date.now();
sortLargeArrays(5, 100000);
console.log(`   Durée: ${Date.now() - start3}ms\n`);

// Test 4: Multiplication de matrices
console.log('4. Test matMul (100x100, 10 répétitions)...');
const start4 = Date.now();
const result = matMul(100, 10);
console.log(`   Durée: ${Date.now() - start4}ms, Résultat: ${result}\n`);

// Test 5: Crible d'Ératosthène
console.log('5. Test sieveCountPrimes (limite 1M)...');
const start5 = Date.now();
const primes = sieveCountPrimes(1000000);
console.log(`   Durée: ${Date.now() - start5}ms, Nombres premiers trouvés: ${primes}\n`);

// Test 6: Allocation mémoire
console.log('6. Test holdMegabytes (50MB)...');
const start6 = Date.now();
const memBlocks = holdMegabytes(50);
console.log(`   Durée: ${Date.now() - start6}ms, Blocs alloués: ${memBlocks.length}\n`);

console.log('Tests terminés!');