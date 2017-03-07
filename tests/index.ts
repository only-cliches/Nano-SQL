// Just started adding proper tests....

import { SomeSQL } from "../index";
import { expect, assert } from "chai";
import "mocha";

before((done) => {
    console.log("HEY");
    done();
})

describe('Hello function', () => {
  it('should return hello world', () => {
    SomeSQL("user").model([{key:"id",type:"int"}]).connect().then((rows, db) => {
        expect(db).to.equal(SomeSQL());
    });
  });
});