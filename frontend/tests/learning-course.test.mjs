import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newCourse, newLesson, runExperiment, lessonComplete, parseCourse } from '../src/utils/learningCourse.ts';

function play(id, actions, initial = newLesson(id)) {
  return actions.reduce((state, action) => runExperiment(id, state, action).state, initial);
}

test('request completion needs both observed outcomes and an explanation, not just a connection', () => {
  let state = { ...newLesson('request'), answer: 'process' };
  assert.equal(lessonComplete('request', state), false);
  state = play('request', ['toggle-app', 'send'], state);
  assert.equal(state.screen, '「こんにちは！」を受け取りました');
  assert.equal(lessonComplete('request', state), false);
  state = play('request', ['toggle-app', 'send'], state);
  assert.equal(state.screen, null);
  assert.equal(lessonComplete('request', state), true);
  assert.equal(lessonComplete('request', { ...state, answer: 'display' }), false);
  assert.equal(runExperiment('request', { ...state, draft: '  ' }, 'send').result.title, 'メッセージを入力してください');
  assert.equal(runExperiment('request', newLesson('request'), 'add-database').state.databaseAdded, false);
});

test('memory loss must be observed after a saved message and an actual restart', () => {
  assert.equal(play('storage', ['read']).sawVolatileLoss, false);
  assert.equal(play('storage', ['restart', 'read']).sawVolatileLoss, false);
  assert.equal(play('storage', ['save', 'read']).sawVolatileLoss, false);
  const state = play('storage', ['save', 'restart', 'restart', 'read']);
  assert.equal(state.memory, null);
  assert.equal(state.screen, null);
  assert.equal(state.sawVolatileLoss, true);
});

test('a DB must be added and connected; a disconnected DB never silently falls back to memory', () => {
  let state = play('storage', ['toggle-database']);
  assert.equal(state.databaseConnected, false);
  state = play('storage', ['add-database', 'save'], state);
  assert.equal(state.database, null);
  assert.equal(state.memory, null);
  state = play('storage', ['toggle-database', 'save', 'restart', 'toggle-database', 'read'], state);
  assert.equal(state.database, 'こんにちは！');
  assert.equal(state.screen, null);
  assert.equal(state.sawDurableRead, false);
  const failedWrite = runExperiment('storage', { ...state, draft: '変更する' }, 'save').state;
  assert.equal(failedWrite.database, 'こんにちは！');
  state = play('storage', ['toggle-database', 'read'], failedWrite);
  assert.equal(state.screen, 'こんにちは！');
  assert.equal(state.sawDurableRead, true);
});

test('both configurations can be compared in either order without losing learned checkpoints', () => {
  let state = play('storage', ['add-database', 'toggle-database', 'save', 'read']);
  assert.equal(state.sawDurableRead, false);
  state = play('storage', ['restart', 'read', 'remove-database', 'save', 'restart', 'read'], state);
  assert.equal(state.database, null);
  assert.equal(state.sawDurableRead, true);
  assert.equal(state.sawVolatileLoss, true);
  assert.equal(lessonComplete('storage', { ...state, answer: 'always' }), false);
  assert.equal(lessonComplete('storage', { ...state, answer: 'separate' }), true);
});

test('learning progress and experiment state round trip independently of project JSON', () => {
  const course = newCourse();
  course.current = 'storage';
  course.lessons.request = { ...play('request', ['send', 'toggle-app', 'send']), answer: 'process' };
  course.lessons.storage = play('storage', ['save', 'restart', 'read', 'add-database', 'toggle-database', 'save', 'restart']);
  const restored = parseCourse(JSON.stringify(course));
  assert.deepEqual(restored, course);
  assert.equal(play('storage', ['read'], restored.lessons.storage).sawDurableRead, true);
  assert.equal(lessonComplete('request', restored.lessons.request), true);
});

test('invalid and future progress is rejected, and unknown properties cannot become runtime state', () => {
  for (const raw of ['{', 'null', '[]', JSON.stringify({ ...newCourse(), version: 3 }), JSON.stringify({ ...newCourse(), current: 'unknown' })]) assert.throws(() => parseCourse(raw));
  for (const [key, value] of [['databaseAdded', 'yes'], ['memory', {}], ['draft', 'a'.repeat(61)], ['screen', 'a'.repeat(101)], ['restartSource', 'fake']]) {
    const course = newCourse();
    course.lessons.storage[key] = value;
    assert.throws(() => parseCourse(JSON.stringify(course)));
  }
  const course = newCourse();
  course.lessons.storage.extra = '<script>hello</script>';
  course.lessons.storage.databaseConnected = true;
  const safe = parseCourse(JSON.stringify(course));
  assert.equal(safe.lessons.storage.extra, undefined);
  assert.equal(safe.lessons.storage.databaseConnected, false);
});
