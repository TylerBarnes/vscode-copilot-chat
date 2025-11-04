// Simple test without vitest
const calls: any[] = [];

function mockFn() {
    const fn = (...args: any[]) => {
        calls.push(args);
        return { iconPath: undefined, dispose: () => {} };
    };
    fn.mock = { calls };
    return fn;
}

const createChatParticipant = mockFn();

// Create a simple class
class TestClass {
    constructor() {
        createChatParticipant('test-id', this.handleRequest.bind(this));
    }

    private async handleRequest(a: string, b: string): Promise<void> {
        console.log('handleRequest called with:', a, b);
    }
}

// Create instance
const instance = new TestClass();

// Extract handler
const handler = createChatParticipant.mock.calls[0][1];
console.log('Handler:', handler);
console.log('Handler type:', typeof handler);

// Call handler
handler('arg1', 'arg2').then(() => {
    console.log('Handler completed');
});
