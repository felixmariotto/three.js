import {
	Mesh,
	Vector3,
	Box3,
	Sphere,
	Quaternion,
	WebGLRenderTarget,
	RGBAFormat,
	NearestFilter,
	MathUtils,
	PlaneGeometry,
	MeshBasicMaterial,
	DoubleSide
} from '../../../build/three.module.js';

// TODO :
// - put several impostors texture per rendertarget

const _v1 = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();

class Impostor extends Mesh {

	constructor( object3D, camera, renderer, scene ) {

		const DEFAULT_TEXTURE_SIZE = 512;

		const renderTarget = new WebGLRenderTarget(
			DEFAULT_TEXTURE_SIZE,
			DEFAULT_TEXTURE_SIZE,
			{ 
				minFilter: NearestFilter,
				magFilter: NearestFilter,
				format: RGBAFormat
			}
		);

		const geometry = new PlaneGeometry( 1, 1 );

		super( geometry, new MeshBasicMaterial( {
			map: renderTarget.texture,
			color: 0xffffff,
			transparent: true,
			// side: DoubleSide
		} ) );

		this.scale.set( 10, 10, 1 );

		this.renderTarget = renderTarget;
		this.type = 'Impostor';
		this.redrawInterval = null; // in ms, skipped if null.
		this.impostureDistance = 70; // world distance.
		this.maxAngle = 0.5;
		this.camera = camera;
		this.renderer = renderer;
		this.scene = scene;
		this.visible = false;
		this.lights = [];

		this.scene.add( this );

		// internal

		object3D._impostor = this;
		this._forged = object3D;

		this._isForging = false;
		this._lastViewAngle = new Vector3();
		this._boundingBox = new Box3();
		this._boundingSphere = new Sphere();
		this._boundingSphereOffset = new Vector3();

		// test
		this.redraw();

	}

	update() {

		// check the distance between the camera and the forged object,
		// and update impostor/importored visibility accordingly.

		this.camera.updateWorldMatrix( true, false );
		this._forged.updateWorldMatrix( true, false );

		_v1.setScalar( 0 ).applyMatrix4( this.camera.matrixWorld );
		_v2.setScalar( 0 ).applyMatrix4( this._forged.matrixWorld );
		
		if ( _v1.distanceTo( _v2 ) > this.impostureDistance ) {

			this.setImposture();

			// check if the new view angle justify a redraw of the impostor texture

			this._forged.worldToLocal( _v1 );
			_v1.normalize();

			if ( _v1.angleTo( this._lastViewAngle ) > this.maxAngle ) {

				this.redraw();

			}

		} else {

			this.unsetImposture();

		}

		// if a redrawInterval parameter was set, we redraw the impostor
		// even if the camera angle doesn't justify a redraw.

		if ( this.redrawInterval !== null ) {

			if (
				!this.lastRedrawDate ||
				( Date.now() - this.lastRedrawDate > this.redrawInterval )
			) {

				this.redraw();

			}

		}

		// move the impostor at the forged object position

		this.position
		.copy( _v2 )
		.add( this._boundingSphereOffset );

	}

	//

	setImposture() {

		if ( !this._isForging ) {

			this._forged.visible = false;
			this.visible = true;

			this._isForging = true;

			this.redraw();

		}

	}

	//

	unsetImposture() {

		if ( this._isForging ) {

			this._forged.visible = true;
			this.visible = false;

			this._isForging = false;

		}

	}

	// render the forged object on the impostor texture.

	redraw() {

		this._forged.visible = true;
		this.visible = false;

		// the impostor will be subject to fog, so we don't want the fog to
		// have an effect when rendering on the texture.

		const fog = this.scene.fog;
		this.scene.fog = null;

		//

		this.attachLights();
		
		// make scene background transparent.

		const sceneBackground = this.scene.background;
		this.scene.background = null;

		// move the camera to render the object full screen.

		_q.copy( this.camera.quaternion );

		this._boundingBox.setFromObject( this._forged );
		this._boundingBox.getBoundingSphere( this._boundingSphere );
		this.camera.lookAt( this._boundingSphere.center );

		// update camera fov to fit the forged object.

		const camFov = this.camera.fov;
		const camAspect = this.camera.aspect;

		this.camera.updateWorldMatrix( false, false );
		_v1.setScalar( 0 ).applyMatrix4( this.camera.matrixWorld );
		const distance = _v1.distanceTo( this._boundingSphere.center );
		const targetAngle = 2 * Math.atan( this._boundingSphere.radius / distance );

		this.camera.fov = MathUtils.radToDeg( targetAngle );
		this.camera.aspect = 1;

		this.camera.updateProjectionMatrix();

		// update the impostor scale according to the object bounding box.

		this.scale.set(
			this._boundingSphere.radius * 2,
			this._boundingSphere.radius * 2,
			1
		);

		// render the texture.

		this.renderer.setRenderTarget( this.renderTarget );
		this.renderer.render( this._forged, this.camera );

		// undo changes made for the texture render.

		this.renderer.setRenderTarget( null );

		this._forged.visible = !this._isForging;
		this.visible = this._isForging;

		this.scene.fog = fog;
		this.scene.background = sceneBackground;

		this.camera.quaternion.copy( _q );

		this.camera.fov = camFov;
		this.camera.aspect = camAspect;
		this.camera.updateProjectionMatrix();

		this.detachLights();

		// record the last draw angle, so we can know
		// when the current view angle exceeds the maximum.
		// the angle is recorded in forged object space, to account
		// for the object rotation.

		this.camera.updateWorldMatrix( true, false );
		this._forged.updateWorldMatrix( true, false );

		this._lastViewAngle.setScalar( 0 ).applyMatrix4( this.camera.matrixWorld );
		this._forged.worldToLocal( this._lastViewAngle );
		this._lastViewAngle.normalize();

		// in case redrawInterval is set.

		this.lastRedrawDate = Date.now();

		// we record the offset between the bounding sphere center and
		// the forged object position, because the impostor plane is centered
		// on the object geometry and we want to move the impostor each from
		// to match the object position.

		this._forged.updateWorldMatrix( false, false );
		_v2.setScalar( 0 ).applyMatrix4( this._forged.matrixWorld );

		this._boundingSphereOffset.copy( this._boundingSphere.center );
		this._boundingSphereOffset.sub( _v2 );

		// make the plane orient towards the camera

		

		setTimeout( () => {
			this.camera.updateWorldMatrix( true, false );
		_v1.setScalar( 0 ).applyMatrix4( this.camera.matrixWorld );
			// this.lookAt( 0, 0, 0 );
			this.lookAt( _v1 );
		}, 10 )

	}

	//

	attachLights() {

		this.lights.forEach( light => {

			light._originalParent = light.parent;

			this._forged.attach( light );

		} );

	}

	//

	detachLights() {

		this._forged.children.forEach( child => {

			if ( child.isLight ) {

				if ( child._originalParent ) {

					child._originalParent.attach( child );

				} else {

					this.scene.attach( child );

				}

			}

		} );

	}

}

Impostor.prototype.isImpostor = true;

export { Impostor }
