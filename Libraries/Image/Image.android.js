/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

'use strict';

const DeprecatedImageStylePropTypes = require('DeprecatedImageStylePropTypes');
const DeprecatedStyleSheetPropType = require('DeprecatedStyleSheetPropType');
const DeprecatedViewPropTypes = require('DeprecatedViewPropTypes');
const ImageViewNativeComponent = require('ImageViewNativeComponent');
const NativeModules = require('NativeModules');
const PropTypes = require('prop-types');
const React = require('React');
const ReactNative = require('ReactNative'); // eslint-disable-line no-unused-vars
const StyleSheet = require('StyleSheet');
const TextAncestor = require('TextAncestor');

const flattenStyle = require('flattenStyle');
const merge = require('merge');
const resolveAssetSource = require('resolveAssetSource');

const {ImageLoader} = NativeModules;

const TextInlineImageNativeComponent = require('TextInlineImageNativeComponent');

import type {ImageProps as ImagePropsType} from 'ImageProps';

let _requestId = 1;
function generateRequestId() {
  return _requestId++;
}

const ImageProps = {
  ...DeprecatedViewPropTypes,
  style: DeprecatedStyleSheetPropType(DeprecatedImageStylePropTypes),
  /**
   * See https://facebook.github.io/react-native/docs/image.html#source
   */
  source: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
      headers: PropTypes.objectOf(PropTypes.string),
    }),
    // Opaque type returned by require('./image.jpg')
    PropTypes.number,
    // Multiple sources
    PropTypes.arrayOf(
      PropTypes.shape({
        uri: PropTypes.string,
        width: PropTypes.number,
        height: PropTypes.number,
        headers: PropTypes.objectOf(PropTypes.string),
      }),
    ),
  ]),
  /**
   * blurRadius: the blur radius of the blur filter added to the image
   *
   * See https://facebook.github.io/react-native/docs/image.html#blurradius
   */
  blurRadius: PropTypes.number,
  /**
   * See https://facebook.github.io/react-native/docs/image.html#defaultsource
   */
  defaultSource: PropTypes.number,
  /**
   * See https://facebook.github.io/react-native/docs/image.html#loadingindicatorsource
   */
  loadingIndicatorSource: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    // Opaque type returned by require('./image.jpg')
    PropTypes.number,
  ]),
  progressiveRenderingEnabled: PropTypes.bool,
  fadeDuration: PropTypes.number,
  /**
   * Invoked on load start
   */
  onLoadStart: PropTypes.func,
  /**
   * Invoked on load error
   */
  onError: PropTypes.func,
  /**
   * Invoked when load completes successfully
   */
  onLoad: PropTypes.func,
  /**
   * Invoked when load either succeeds or fails
   */
  onLoadEnd: PropTypes.func,
  /**
   * Used to locate this view in end-to-end tests.
   */
  testID: PropTypes.string,
  /**
   * The mechanism that should be used to resize the image when the image's dimensions
   * differ from the image view's dimensions. Defaults to `auto`.
   *
   * See https://facebook.github.io/react-native/docs/image.html#resizemethod
   */
  resizeMethod: PropTypes.oneOf(['auto', 'resize', 'scale']),
  /**
   * Determines how to resize the image when the frame doesn't match the raw
   * image dimensions.
   *
   * See https://facebook.github.io/react-native/docs/image.html#resizemode
   */
  resizeMode: PropTypes.oneOf([
    'cover',
    'contain',
    'stretch',
    'repeat',
    'center',
  ]),
};

function getSize(
  url: string,
  success: (width: number, height: number) => void,
  failure?: (error: any) => void,
) {
  return ImageLoader.getSize(url)
    .then(function(sizes) {
      success(sizes.width, sizes.height);
    })
    .catch(
      failure ||
        function() {
          console.warn('Failed to get size for image: ' + url);
        },
    );
}

function prefetch(url: string, callback: ?Function) {
  const requestId = generateRequestId();
  callback && callback(requestId);
  return ImageLoader.prefetchImage(url, requestId);
}

function abortPrefetch(requestId: number) {
  ImageLoader.abortRequest(requestId);
}

/**
 * Perform cache interrogation.
 *
 * See https://facebook.github.io/react-native/docs/image.html#querycache
 */
async function queryCache(
  urls: Array<string>,
): Promise<{[string]: 'memory' | 'disk' | 'disk/memory'}> {
  return await ImageLoader.queryCache(urls);
}

declare class ImageComponentType extends ReactNative.NativeComponent<
  ImagePropsType,
> {
  static getSize: typeof getSize;
  static prefetch: typeof prefetch;
  static abortPrefetch: typeof abortPrefetch;
  static queryCache: typeof queryCache;
  static resolveAssetSource: typeof resolveAssetSource;
  static propTypes: typeof ImageProps;
}

/**
 * A React component for displaying different types of images,
 * including network images, static resources, temporary local images, and
 * images from local disk, such as the camera roll.
 *
 * See https://facebook.github.io/react-native/docs/image.html
 */
let Image = (
  props: ImagePropsType,
  forwardedRef: ?React.Ref<'RCTTextInlineImage' | 'ImageViewNativeComponent'>,
) => {
  let source = resolveAssetSource(props.source);
  const defaultSource = resolveAssetSource(props.defaultSource);
  const loadingIndicatorSource = resolveAssetSource(
    props.loadingIndicatorSource,
  );

  if (source && source.uri === '') {
    console.warn('source.uri should not be an empty string');
  }

  if (props.src) {
    console.warn(
      'The <Image> component requires a `source` property rather than `src`.',
    );
  }

  if (props.children) {
    throw new Error(
      'The <Image> component cannot contain children. If you want to render content on top of the image, consider using the <ImageBackground> component or absolute positioning.',
    );
  }

  if (props.defaultSource && props.loadingIndicatorSource) {
    throw new Error(
      'The <Image> component cannot have defaultSource and loadingIndicatorSource at the same time. Please use either defaultSource or loadingIndicatorSource.',
    );
  }

  if (source && !source.uri && !Array.isArray(source)) {
    source = null;
  }

  let style;
  let sources;
  if (source?.uri != null) {
    /* $FlowFixMe(>=0.78.0 site=react_native_android_fb) This issue was found
     * when making Flow check .android.js files. */
    const {width, height} = source;
    style = flattenStyle([{width, height}, styles.base, props.style]);
    /* $FlowFixMe(>=0.78.0 site=react_native_android_fb) This issue was found
     * when making Flow check .android.js files. */
    sources = [{uri: source.uri}];
  } else {
    style = flattenStyle([styles.base, props.style]);
    sources = source;
  }

  const {onLoadStart, onLoad, onLoadEnd, onError} = props;
  const nativeProps = merge(props, {
    style,
    shouldNotifyLoadEvents: !!(onLoadStart || onLoad || onLoadEnd || onError),
    src: sources,
    /* $FlowFixMe(>=0.78.0 site=react_native_android_fb) This issue was found
     * when making Flow check .android.js files. */
    headers: source?.headers,
    defaultSrc: defaultSource ? defaultSource.uri : null,
    loadingIndicatorSrc: loadingIndicatorSource
      ? loadingIndicatorSource.uri
      : null,
    ref: forwardedRef,
  });

  return (
    <TextAncestor.Consumer>
      {hasTextAncestor =>
        hasTextAncestor ? (
          <TextInlineImageNativeComponent {...nativeProps} />
        ) : (
          <ImageViewNativeComponent {...nativeProps} />
        )
      }
    </TextAncestor.Consumer>
  );
};

Image = React.forwardRef(Image);
Image.displayName = 'Image';

/**
 * Retrieve the width and height (in pixels) of an image prior to displaying it
 *
 * See https://facebook.github.io/react-native/docs/image.html#getsize
 */
/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
Image.getSize = getSize;

/**
 * Prefetches a remote image for later use by downloading it to the disk
 * cache
 *
 * See https://facebook.github.io/react-native/docs/image.html#prefetch
 */
/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
Image.prefetch = prefetch;

/**
 * Abort prefetch request.
 *
 * See https://facebook.github.io/react-native/docs/image.html#abortprefetch
 */
/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
Image.abortPrefetch = abortPrefetch;

/**
 * Perform cache interrogation.
 *
 * See https://facebook.github.io/react-native/docs/image.html#querycache
 */
/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
Image.queryCache = queryCache;

/**
 * Resolves an asset reference into an object.
 *
 * See https://facebook.github.io/react-native/docs/image.html#resolveassetsource
 */
/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
Image.resolveAssetSource = resolveAssetSource;

/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
Image.propTypes = ImageProps;

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

/* $FlowFixMe(>=0.89.0 site=react_native_android_fb) This comment suppresses an
 * error found when Flow v0.89 was deployed. To see the error, delete this
 * comment and run Flow. */
module.exports = (Image: Class<ImageComponentType>);
