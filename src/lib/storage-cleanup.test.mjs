import { test } from "node:test";
import assert from "node:assert/strict";
import { removePhotoObjects } from "./.tmptest/storage-cleanup.js";

function makeStorage(opts) {
  const calls = [];
  let callIndex = 0;
  const client = {
    storage: {
      from(bucket) {
        return {
          remove(paths) {
            calls.push({ bucket, paths });
            const fail =
              opts && opts.failAt != null ? callIndex === opts.failAt : false;
            callIndex++;
            return { error: fail ? { message: "boom" } : null };
          },
        };
      },
    },
  };
  client.__calls = calls;
  return client;
}

test("empty path list does not call Storage remove and reports success", async () => {
  const client = makeStorage();
  const result = await removePhotoObjects(client, []);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 0);
  assert.deepEqual(result.failed, []);
  assert.equal(client.__calls.length, 0);
});

test("null/undefined/empty paths are ignored and not sent to Storage", async () => {
  const client = makeStorage();
  const result = await removePhotoObjects(client, [null, undefined, ""]);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 0);
  assert.equal(client.__calls.length, 0);
});

test("normal paths are passed to Storage and reported as removed", async () => {
  const client = makeStorage();
  const paths = ["2023/e1/a.jpg", "2023/e1/b.jpg"];
  const result = await removePhotoObjects(client, paths);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 2);
  assert.deepEqual(result.failed, []);
  assert.equal(client.__calls.length, 1);
  assert.equal(client.__calls[0].bucket, "photos");
  assert.deepEqual(client.__calls[0].paths, paths);
});

test("large path lists are chunked into ~100 per Storage call", async () => {
  const client = makeStorage();
  const paths = [];
  for (let i = 0; i < 250; i++) paths.push("2023/e1/p" + i + ".jpg");
  const result = await removePhotoObjects(client, paths);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 250);
  assert.equal(client.__calls.length, 3);
  assert.equal(client.__calls[0].paths.length, 100);
  assert.equal(client.__calls[1].paths.length, 100);
  assert.equal(client.__calls[2].paths.length, 50);
});

test("Storage failure is surfaced and not reported as success", async () => {
  const client = makeStorage({ failAt: 0 });
  const paths = ["2023/e1/a.jpg", "2023/e1/b.jpg"];
  const result = await removePhotoObjects(client, paths);
  assert.equal(result.ok, false);
  assert.equal(result.removed, 0);
  assert.deepEqual(result.failed.sort(), paths.slice().sort());
});

test("duplicate paths are de-duplicated before removal", async () => {
  const client = makeStorage();
  const result = await removePhotoObjects(client, [
    "2023/e1/a.jpg",
    "2023/e1/a.jpg",
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.removed, 1);
  assert.deepEqual(client.__calls[0].paths, ["2023/e1/a.jpg"]);
});
