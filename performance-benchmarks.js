const crypto = require('crypto');

function runForMillis(durMs, fn) {
    const end = Date.now() + Math.max(1, durMs);
    while (Date.now() < end) {
        fn();
    }
}

function busySpin(durMs) {
    runForMillis(durMs, () => {});
}

function cpuHashSha256(durMs, payloadKb) {
    const data = Buffer.alloc(Math.max(1, payloadKb) * 1024);
    
    // Fill with deterministic data (like Java's Random(42))
    for (let i = 0; i < data.length; i++) {
        data[i] = (i * 31 + 42) % 256;
    }
    
    runForMillis(durMs, () => {
        const hash = crypto.createHash('sha256');
        hash.update(data);
        hash.digest();
    });
}

function sortLargeArrays(arrays, size) {
    // Simple seeded random number generator
    let seed = 123;
    const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed;
    };
    
    for (let i = 0; i < arrays; i++) {
        const arr = new Array(size);
        for (let j = 0; j < size; j++) {
            arr[j] = random();
        }
        arr.sort((a, b) => a - b);
    }
}

function matMul(n, reps) {
    const A = Array(n).fill().map(() => Array(n).fill(0));
    const B = Array(n).fill().map(() => Array(n).fill(0));
    const C = Array(n).fill().map(() => Array(n).fill(0));
    
    // Simple seeded random number generator
    let seed = 7;
    const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
    
    // Initialize matrices
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            A[i][j] = random();
            B[i][j] = random();
        }
    }
    
    let acc = 0;
    for (let rep = 0; rep < reps; rep++) {
        for (let i = 0; i < n; i++) {
            for (let k = 0; k < n; k++) {
                const aik = A[i][k];
                for (let j = 0; j < n; j++) {
                    C[i][j] += aik * B[k][j];
                }
            }
        }
        acc += Math.floor(C[0][0]);
    }
    return acc;
}

function sieveCountPrimes(limit) {
    const isPrime = new Array(limit + 1).fill(true);
    isPrime[0] = isPrime[1] = false;
    
    for (let p = 2; p * p <= limit; p++) {
        if (isPrime[p]) {
            for (let k = p * p; k <= limit; k += p) {
                isPrime[k] = false;
            }
        }
    }
    
    let count = 0;
    for (let i = 2; i <= limit; i++) {
        if (isPrime[i]) count++;
    }
    return count;
}

function holdMegabytes(mb) {
    const blockSize = 1 * 1024 * 1024; // 1MB
    const list = [];
    for (let i = 0; i < mb; i++) {
        list.push(Buffer.alloc(blockSize));
    }
    return list;
}

module.exports = {
    runForMillis,
    busySpin,
    cpuHashSha256,
    sortLargeArrays,
    matMul,
    sieveCountPrimes,
    holdMegabytes
};