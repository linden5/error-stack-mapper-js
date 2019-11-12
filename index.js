const readline = require('readline')
const mapErrorToSrc = require('./lib')

function digestError(errorMessage) {
    return mapErrorToSrc(errorMessage).then(result => {
        console.log(result)
    }).catch(error => {
        console.error(error)
    })
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

console.log('please input error info, which ends with a "done" in a new line: \n')

let errorMessage = ''
rl.on('line', function (line) {
    if (line === 'done') {
        digestError(errorMessage).then(() => {
            console.log('processing finished')
        })
        errorMessage = ''
    } else {
        // need to add \n manually
        errorMessage = errorMessage + '\n' + line
    }
})

rl.on('SIGINT', function () {
    rl.close()
    process.exit(0)
})
