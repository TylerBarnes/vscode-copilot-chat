import { vi } from 'vitest';

class TestClass {
    constructor(private manager: any) {}
    
    async doSomething() {
        console.log('[doSomething] calling manager.createSession');
        const result = await this.manager.createSession('test');
        console.log('[doSomething] result:', result);
        return result;
    }
}

async function test() {
    const mockManager = {
        createSession: vi.fn().mockImplementation(async (id: string) => {
            console.log('[MOCK] createSession called with:', id);
            return 'session-123';
        })
    };

    console.log('Creating instance...');
    const instance = new TestClass(mockManager);

    console.log('Calling doSomething...');
    await instance.doSomething();

    console.log('mockManager.createSession.mock.calls:', mockManager.createSession.mock.calls);
    console.log('Expected: [["test"]]');
}

test();
