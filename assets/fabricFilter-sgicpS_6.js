import{C as e,_ as t,g as n,n as r,x as i}from"./src-BjyfroxI.js";import{t as a}from"./replaceColors-DxRxZCsd.js";var o=[new URL(`/epdoptimize/assets/affiche-plm-geneve-DEh4Na5p.jpg`,``+import.meta.url).href,new URL(`/epdoptimize/assets/balcony-DF-4ba-H.jpeg`,``+import.meta.url).href,new URL(`/epdoptimize/assets/color_screenshot-C3FBxbDJ.png`,``+import.meta.url).href,new URL(`/epdoptimize/assets/be-kind-to-books-club-lccn2011645392-ShEFznhX.jpg`,``+import.meta.url).href],s=900,c=1,l=1,u=e=>document.getElementById(e),d=u(`fabricCanvas`),f=u(`ditheredCanvas`),ee=u(`deviceCanvas`),p=u(`fileInput`),te=u(`addImageButton`),ne=u(`addTextButton`),re=u(`addBlockButton`),ie=u(`deleteButton`),ae=u(`autoButton`),oe=u(`resetButton`),m=u(`renderButton`),se=u(`bringForwardButton`),ce=u(`sendBackButton`),le=u(`centerButton`),h=u(`selectionStatus`),ue=u(`appStatus`),de=u(`previewStatus`),g=u(`reasonsList`),_=u(`exposureInput`),v=u(`contrastInput`),y=u(`saturationInput`),b=u(`shadowsInput`),x=u(`highlightsInput`),S=u(`webglTonePreviewInput`),C=u(`disableDebounceInput`),w=u(`clarityEnabledInput`),T=u(`clarityAmountInput`),E=u(`clarityRadiusInput`),D=u(`dynamicRangeEnabledInput`),O=u(`dynamicRangeStrengthInput`),k=u(`dynamicRangeLowInput`),A=u(`dynamicRangeHighInput`),j=u(`levelEnabledInput`),M=u(`levelAutoInput`),N=u(`levelThresholdInput`),P=u(`levelLowInput`),F=u(`levelHighInput`),I=[{input:_,value:u(`exposureValue`),digits:2},{input:v,value:u(`contrastValue`),digits:2},{input:y,value:u(`saturationValue`),digits:2},{input:b,value:u(`shadowsValue`),digits:2},{input:x,value:u(`highlightsValue`),digits:2},{input:T,value:u(`clarityAmountValue`),digits:2},{input:E,value:u(`clarityRadiusValue`),digits:2},{input:O,value:u(`dynamicRangeStrengthValue`),digits:2},{input:k,value:u(`dynamicRangeLowValue`),digits:3},{input:A,value:u(`dynamicRangeHighValue`),digits:3},{input:N,value:u(`levelThresholdValue`),digits:3},{input:P,value:u(`levelLowValue`),digits:3},{input:F,value:u(`levelHighValue`),digits:3}],fe=[_,v,y,b,x,S,C,w,T,E,D,O,k,A,j,M,N,P,F,ae,oe],pe=[],L,R=0,me=0,he=0,ge=0,z=(e,t,n)=>Math.min(n,Math.max(t,e)),_e=e=>{let t=e.replace(`#`,``),n=t.length===3?t.split(``).map(e=>e+e).join(``):t;return[Number.parseInt(n.slice(0,2),16),Number.parseInt(n.slice(2,4),16),Number.parseInt(n.slice(4,6),16)]},B=e=>{let t=e/255;return t>.04045?((t+.055)/1.055)**2.4:t/12.92},ve=e=>e>.008856?Math.cbrt(e):7.787*e+16/116,ye=([e,t,n])=>116*ve(B(e)*.2126729+B(t)*.7151522+B(n)*.072175)-16,V=([e,t,n])=>.2126*e+.7152*t+.0722*n,be=(()=>{let e=r.map(e=>_e(e.color)),t=e[0],n=e[0];for(let r of e)V(r)<V(t)&&(t=r),V(r)>V(n)&&(n=r);let i=ye(t),a=ye(n);return{blackL:i,whiteL:a,targetRange:Math.max(1e-4,a-i)}})(),H=e=>Number(e.value),xe=e=>e<0?Math.max(.5,1+e*.5):e+1,U=(e,t)=>{e.value=String(t),W(e)},W=e=>{let t=I.find(t=>t.input===e);t&&(t.value.textContent=H(e).toFixed(t.digits??2))},Se=()=>{I.forEach(({input:e})=>W(e))},G=()=>L?.getActiveObject()??null,Ce=e=>e?.type===`image`,K=()=>{let e=G();return Ce(e)?e:null},q=(e,t=!1)=>{ue.textContent=e,ue.classList.toggle(`warn`,t)},J=(e,t=!1)=>{de.textContent=e,de.classList.toggle(`warn`,t)},we=e=>{let t=z(e.shadows??0,-1,1),n=z(e.highlights??0,-1,1),r=t!==0||n!==0;return{exposure:e.exposure??0,contrast:e.contrast??0,saturation:e.saturation??0,strength:r?e.toneStrength??.8:0,shadowBoost:t*c,highlightCompress:n*l,midpoint:e.toneMidpoint??.5}},Te=`
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uExposureMultiplier;
  uniform float uSaturationMultiplier;
  uniform float uContrastMultiplier;
  uniform float uUseCurve;
  uniform float uStrength;
  uniform float uShadowBoost;
  uniform float uHighlightCompress;
  uniform float uMidpoint;
  varying vec2 vTexCoord;
  const float SHADOW_TONE_RESPONSE = 1.5;

  vec3 applyHslSaturation(vec3 rgb, float saturationMultiplier) {
    float maxChannel = max(max(rgb.r, rgb.g), rgb.b);
    float minChannel = min(min(rgb.r, rgb.g), rgb.b);
    float lightness = (maxChannel + minChannel) * 0.5;

    if (maxChannel == minChannel) {
      return rgb;
    }

    float delta = maxChannel - minChannel;
    float saturation = lightness > 0.5
      ? delta / (2.0 - maxChannel - minChannel)
      : delta / max(maxChannel + minChannel, 0.000001);
    float hue;

    if (maxChannel == rgb.r) {
      hue = ((rgb.g - rgb.b) / delta + (rgb.g < rgb.b ? 6.0 : 0.0)) / 6.0;
    }
    else if (maxChannel == rgb.g) {
      hue = ((rgb.b - rgb.r) / delta + 2.0) / 6.0;
    }
    else {
      hue = ((rgb.r - rgb.g) / delta + 4.0) / 6.0;
    }

    float newSaturation = clamp(saturation * saturationMultiplier, 0.0, 1.0);
    float chroma = (1.0 - abs(2.0 * lightness - 1.0)) * newSaturation;
    float x = chroma * (1.0 - abs(mod(hue * 6.0, 2.0) - 1.0));
    float m = lightness - chroma * 0.5;
    float sector = floor(hue * 6.0);
    vec3 prime;

    if (sector < 1.0) {
      prime = vec3(chroma, x, 0.0);
    }
    else if (sector < 2.0) {
      prime = vec3(x, chroma, 0.0);
    }
    else if (sector < 3.0) {
      prime = vec3(0.0, chroma, x);
    }
    else if (sector < 4.0) {
      prime = vec3(0.0, x, chroma);
    }
    else if (sector < 5.0) {
      prime = vec3(x, 0.0, chroma);
    }
    else {
      prime = vec3(chroma, 0.0, x);
    }

    return clamp(prime + vec3(m), 0.0, 1.0);
  }

  float curveChannel(float value) {
    float mid = clamp(uMidpoint, 0.01, 0.99);
    float shadowExponent = clamp(
      1.0 - uStrength * uShadowBoost * SHADOW_TONE_RESPONSE,
      0.15,
      3.0
    );
    float highlightExponent = clamp(1.0 - uStrength * uHighlightCompress, 0.15, 3.0);

    if (value <= mid) {
      float shadowValue = clamp(value / mid, 0.0, 1.0);
      return pow(shadowValue, shadowExponent) * mid;
    }

    float highlightValue = clamp((value - mid) / (1.0 - mid), 0.0, 1.0);
    return mid + pow(highlightValue, highlightExponent) * (1.0 - mid);
  }

  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    vec3 rgb = clamp(color.rgb * uExposureMultiplier, 0.0, 1.0);
    rgb = applyHslSaturation(rgb, uSaturationMultiplier);
    rgb = clamp((rgb - 0.5) * uContrastMultiplier + 0.5, 0.0, 1.0);

    if (uUseCurve > 0.5) {
      rgb = vec3(
        curveChannel(rgb.r),
        curveChannel(rgb.g),
        curveChannel(rgb.b)
      );
    }

    gl_FragColor = vec4(rgb, color.a);
  }
`,Ee=e=>{let t=z(e.shadows??0,-1,1),n=z(e.highlights??0,-1,1),r=t!==0||n!==0;return{exposureMultiplier:2**(e.exposure??0),saturationMultiplier:Math.max(0,(e.saturation??0)+1),contrastMultiplier:xe(e.contrast??0),useCurve:+!!r,strength:r?e.toneStrength??.8:0,shadowBoost:t*c,highlightCompress:n*l,midpoint:e.toneMidpoint??.5}},De=`
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uEnabled;
  uniform float uAmount;
  uniform float uRadius;
  uniform float uMidtone;
  uniform float uTexelX;
  uniform float uTexelY;
  varying vec2 vTexCoord;

  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    if (uEnabled < 0.5 || abs(uAmount) <= 0.0001) {
      gl_FragColor = color;
      return;
    }

    float radius = clamp(floor(uRadius + 0.5), 1.0, 4.0);
    vec3 sum = vec3(0.0);
    float count = 0.0;

    for (int y = -4; y <= 4; y++) {
      for (int x = -4; x <= 4; x++) {
        vec2 offset = vec2(float(x), float(y));
        if (abs(offset.x) <= radius && abs(offset.y) <= radius) {
          vec2 sampleCoord = clamp(
            vTexCoord + vec2(offset.x * uTexelX, offset.y * uTexelY),
            vec2(0.0),
            vec2(1.0)
          );
          sum += texture2D(uTexture, sampleCoord).rgb;
          count += 1.0;
        }
      }
    }

    vec3 blurred = sum / max(count, 1.0);
    float lightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
    float midtoneWeight = pow(
      clamp(1.0 - abs(2.0 * lightness - 1.0), 0.0, 1.0),
      max(uMidtone, 0.1)
    );
    vec3 rgb = clamp(
      color.rgb + (uAmount * 2.0) * (color.rgb - blurred) * midtoneWeight,
      0.0,
      1.0
    );

    gl_FragColor = vec4(rgb, color.a);
  }
`,Oe=`
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uEnabled;
  uniform float uStrength;
  uniform float uBlackL;
  uniform float uTargetRange;
  varying vec2 vTexCoord;

  float srgbToLinear(float value) {
    return value > 0.04045
      ? pow((value + 0.055) / 1.055, 2.4)
      : value / 12.92;
  }

  float linearToSrgb(float value) {
    return value > 0.0031308
      ? 1.055 * pow(max(value, 0.0), 1.0 / 2.4) - 0.055
      : 12.92 * value;
  }

  float labForwardPivot(float value) {
    return value > 0.008856 ? pow(value, 1.0 / 3.0) : 7.787 * value + 16.0 / 116.0;
  }

  vec3 rgbToLab(vec3 rgb) {
    vec3 linearRgb = vec3(
      srgbToLinear(rgb.r),
      srgbToLinear(rgb.g),
      srgbToLinear(rgb.b)
    );
    float x = (linearRgb.r * 0.4124564 + linearRgb.g * 0.3575761 + linearRgb.b * 0.1804375) * 100.0;
    float y = (linearRgb.r * 0.2126729 + linearRgb.g * 0.7151522 + linearRgb.b * 0.0721750) * 100.0;
    float z = (linearRgb.r * 0.0193339 + linearRgb.g * 0.1191920 + linearRgb.b * 0.9503041) * 100.0;
    float xn = labForwardPivot(x / 95.047);
    float yn = labForwardPivot(y / 100.0);
    float zn = labForwardPivot(z / 108.883);
    return vec3(116.0 * yn - 16.0, 500.0 * (xn - yn), 200.0 * (yn - zn));
  }

  vec3 labToXyz(vec3 lab) {
    float y = (lab.x + 16.0) / 116.0;
    float x = lab.y / 500.0 + y;
    float z = y - lab.z / 200.0;

    x = x > 0.206897 ? pow(x, 3.0) : (x - 16.0 / 116.0) / 7.787;
    y = y > 0.206897 ? pow(y, 3.0) : (y - 16.0 / 116.0) / 7.787;
    z = z > 0.206897 ? pow(z, 3.0) : (z - 16.0 / 116.0) / 7.787;

    return vec3(x * 95.047, y * 100.0, z * 108.883);
  }

  vec3 labToRgb(vec3 lab) {
    vec3 xyz = labToXyz(lab) / 100.0;
    vec3 linearRgb = vec3(
      xyz.x * 3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314,
      xyz.x * -0.9692660 + xyz.y * 1.8760108 + xyz.z * 0.0415560,
      xyz.x * 0.0556434 + xyz.y * -0.2040259 + xyz.z * 1.0572252
    );
    return clamp(vec3(
      linearToSrgb(linearRgb.r),
      linearToSrgb(linearRgb.g),
      linearToSrgb(linearRgb.b)
    ), 0.0, 1.0);
  }

  float getSaturation(vec3 rgb) {
    float maxChannel = max(max(rgb.r, rgb.g), rgb.b);
    float minChannel = min(min(rgb.r, rgb.g), rgb.b);
    if (maxChannel <= 0.0) {
      return 0.0;
    }

    return (maxChannel - minChannel) / maxChannel;
  }

  float luma709(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  }

  bool isProtectedChromaFit(float sourceLuma, vec3 resultRgb, float sourceSaturation) {
    if (sourceSaturation < 0.16) {
      return true;
    }
    float resultSaturation = getSaturation(resultRgb);
    float minimumSaturation = max(0.12, sourceSaturation * 0.72);
    if (resultSaturation >= minimumSaturation) {
      return true;
    }
    return luma709(resultRgb) <= sourceLuma + 4.0 / 255.0;
  }

  vec3 guardedLabLightnessFit(vec3 sourceRgb, vec3 sourceLab, float targetL, float amount) {
    float sourceSaturation = getSaturation(sourceRgb);
    float sourceLuma = luma709(sourceRgb);
    vec3 result = labToRgb(vec3(mix(sourceLab.x, targetL, amount), sourceLab.y, sourceLab.z));

    if (targetL <= sourceLab.x || isProtectedChromaFit(sourceLuma, result, sourceSaturation)) {
      return result;
    }

    float low = 0.0;
    float high = amount;
    vec3 protectedResult = sourceRgb;

    for (int step = 0; step < 5; step++) {
      float mid = (low + high) * 0.5;
      vec3 candidate = labToRgb(vec3(mix(sourceLab.x, targetL, mid), sourceLab.y, sourceLab.z));
      if (isProtectedChromaFit(sourceLuma, candidate, sourceSaturation)) {
        low = mid;
        protectedResult = candidate;
      }
      else {
        high = mid;
      }
    }

    return protectedResult;
  }

  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    if (uEnabled < 0.5 || uStrength <= 0.0) {
      gl_FragColor = color;
      return;
    }

    vec3 lab = rgbToLab(color.rgb);
    float normalizedL = clamp(lab.x / 100.0, 0.0, 1.0);
    float targetL = uBlackL + normalizedL * uTargetRange;
    float chromaProtection = smoothstep(0.18, 0.68, getSaturation(color.rgb)) * 0.85;
    float amount = clamp(uStrength * (1.0 - chromaProtection), 0.0, 1.0);
    vec3 rgb = guardedLabLightnessFit(color.rgb, lab, targetL, amount);
    gl_FragColor = vec4(rgb, color.a);
  }
`,ke=`
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uEnabled;
  uniform float uModeLuma;
  uniform float uBlack;
  uniform float uWhite;
  varying vec2 vTexCoord;

  float luma709(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec4 color = texture2D(uTexture, vTexCoord);
    if (uEnabled < 0.5) {
      gl_FragColor = color;
      return;
    }

    float black = clamp(uBlack, 0.0, 1.0);
    float white = clamp(uWhite, 0.0, 1.0);
    float range = white - black;
    if (range <= 0.0001) {
      gl_FragColor = color;
      return;
    }

    vec3 rgb;
    if (uModeLuma > 0.5) {
      float y = luma709(color.rgb);
      float yNew = black + y * range;
      float ratio = y > 0.0 ? yNew / y : 0.0;
      float maxChannel = max(max(color.r, color.g), color.b);
      if (maxChannel > 0.0) {
        ratio = min(ratio, 1.0 / maxChannel);
      }
      rgb = clamp(color.rgb * ratio, 0.0, 1.0);
    }
    else {
      rgb = clamp(black + color.rgb * range, 0.0, 1.0);
    }

    gl_FragColor = vec4(rgb, color.a);
  }
`,Ae=e=>{let t=e.getElement?.()??e._filteredEl??e._element;return{width:Math.max(1,t?.naturalWidth??t?.width??e.width??1),height:Math.max(1,t?.naturalHeight??t?.height??e.height??1)}},je=(e,t)=>{let{width:n,height:r}=Ae(e);t.texelX=1/n,t.texelY=1/r},Y=(e,t,n,a={})=>{let o=fabric.util.createClass(fabric.Image.filters.BaseFilter,{type:e,...a,initialize(e={}){this.callSuper(`initialize`,e),Object.assign(this,t,e)},applyTo2d(e){i(e.imageData,{palette:r,...n(this)})},isNeutralState(){return!1},toObject(){return fabric.util.object.extend(this.callSuper(`toObject`),Object.fromEntries(Object.keys(t).map(e=>[e,this[e]])))}});o.fromObject=fabric.Image.filters.BaseFilter.fromObject,fabric.Image.filters[e]=o},Me=()=>{Y(`EpdToneFilter`,{exposure:0,contrast:0,saturation:0,shadows:0,highlights:0,toneStrength:.8,toneMidpoint:.5},e=>({toneMapping:we(e)}),{fragmentSource:Te,getUniformLocations(e,t){return{uExposureMultiplier:e.getUniformLocation(t,`uExposureMultiplier`),uSaturationMultiplier:e.getUniformLocation(t,`uSaturationMultiplier`),uContrastMultiplier:e.getUniformLocation(t,`uContrastMultiplier`),uUseCurve:e.getUniformLocation(t,`uUseCurve`),uStrength:e.getUniformLocation(t,`uStrength`),uShadowBoost:e.getUniformLocation(t,`uShadowBoost`),uHighlightCompress:e.getUniformLocation(t,`uHighlightCompress`),uMidpoint:e.getUniformLocation(t,`uMidpoint`)}},sendUniformData(e,t){let n=Ee(this);e.uniform1f(t.uExposureMultiplier,n.exposureMultiplier),e.uniform1f(t.uSaturationMultiplier,n.saturationMultiplier),e.uniform1f(t.uContrastMultiplier,n.contrastMultiplier),e.uniform1f(t.uUseCurve,n.useCurve),e.uniform1f(t.uStrength,n.strength),e.uniform1f(t.uShadowBoost,n.shadowBoost),e.uniform1f(t.uHighlightCompress,n.highlightCompress),e.uniform1f(t.uMidpoint,n.midpoint)}}),Y(`EpdClarityFilter`,{enabled:!1,amount:0,radius:1.5,midtone:.5,texelX:1,texelY:1},e=>({clarity:e.enabled?{amount:e.amount,radius:e.radius,midtone:e.midtone}:void 0}),{fragmentSource:De,getUniformLocations(e,t){return{uEnabled:e.getUniformLocation(t,`uEnabled`),uAmount:e.getUniformLocation(t,`uAmount`),uRadius:e.getUniformLocation(t,`uRadius`),uMidtone:e.getUniformLocation(t,`uMidtone`),uTexelX:e.getUniformLocation(t,`uTexelX`),uTexelY:e.getUniformLocation(t,`uTexelY`)}},sendUniformData(e,t){e.uniform1f(t.uEnabled,+!!this.enabled),e.uniform1f(t.uAmount,z(this.amount??0,-1,1)),e.uniform1f(t.uRadius,z(this.radius??1.5,1,4)),e.uniform1f(t.uMidtone,Math.max(.1,this.midtone??.5)),e.uniform1f(t.uTexelX,this.texelX??1),e.uniform1f(t.uTexelY,this.texelY??1)}}),Y(`EpdDynamicRangeFilter`,{enabled:!0,mode:`display`,strength:1,lowPercentile:.02,highPercentile:.98,preserveWhite:!0},e=>({dynamicRangeCompression:e.enabled?{mode:e.mode,strength:e.strength,lowPercentile:e.lowPercentile,highPercentile:e.highPercentile,preserveWhite:e.preserveWhite}:void 0}),{fragmentSource:Oe,getUniformLocations(e,t){return{uEnabled:e.getUniformLocation(t,`uEnabled`),uStrength:e.getUniformLocation(t,`uStrength`),uBlackL:e.getUniformLocation(t,`uBlackL`),uTargetRange:e.getUniformLocation(t,`uTargetRange`)}},sendUniformData(e,t){e.uniform1f(t.uEnabled,+!!this.enabled),e.uniform1f(t.uStrength,z(this.strength??1,0,1)),e.uniform1f(t.uBlackL,be.blackL),e.uniform1f(t.uTargetRange,be.targetRange)}}),Y(`EpdLevelCompressionFilter`,{enabled:!1,mode:`luma`,auto:!0,autoThreshold:.02,lowPercentile:.02,highPercentile:.98},e=>({levelCompression:e.enabled?{mode:e.mode,auto:e.auto,autoThreshold:e.autoThreshold,black:Math.round(z(e.lowPercentile??0,0,1)*255),white:Math.round(z(e.highPercentile??1,0,1)*255)}:void 0}),{fragmentSource:ke,getUniformLocations(e,t){return{uEnabled:e.getUniformLocation(t,`uEnabled`),uModeLuma:e.getUniformLocation(t,`uModeLuma`),uBlack:e.getUniformLocation(t,`uBlack`),uWhite:e.getUniformLocation(t,`uWhite`)}},sendUniformData(e,t){e.uniform1f(t.uEnabled,+!!this.enabled),e.uniform1f(t.uModeLuma,+(this.mode===`luma`)),e.uniform1f(t.uBlack,z(this.lowPercentile??0,0,1)),e.uniform1f(t.uWhite,z(this.highPercentile??1,0,1))}})},X=e=>{e.epdFilterStack??={},e.epdFilterStack.tone??=e.filters.find(e=>e.type===`EpdToneFilter`)??new fabric.Image.filters.EpdToneFilter,e.epdFilterStack.clarity??=e.filters.find(e=>e.type===`EpdClarityFilter`)??new fabric.Image.filters.EpdClarityFilter,e.epdFilterStack.dynamicRange??=e.filters.find(e=>e.type===`EpdDynamicRangeFilter`)??new fabric.Image.filters.EpdDynamicRangeFilter,e.epdFilterStack.level??=e.filters.find(e=>e.type===`EpdLevelCompressionFilter`)??new fabric.Image.filters.EpdLevelCompressionFilter;let{tone:t,clarity:n,dynamicRange:r,level:i}=e.epdFilterStack;return je(e,n),e.filters=[t,n,r,i],{tone:t,clarity:n,dynamicRange:r,level:i}},Ne=()=>{S.checked?(fabric.enableGLFiltering=!0,fabric.filterBackend=fabric.initFilterBackend()):(fabric.enableGLFiltering=!1,fabric.filterBackend=new fabric.Canvas2dFilterBackend)},Z=()=>{Ne(),L?.getObjects().filter(Ce).forEach(e=>{X(e),e.applyFilters()}),L?.requestRenderAll()},Q=(e=!1)=>{let t=K();if(!t){q(`Select an image to use EPD filters.`,!0);return}let n=()=>{t.applyFilters(),L.requestRenderAll()};window.clearTimeout(he),window.cancelAnimationFrame(ge),e||C.checked?n():S.checked?ge=window.requestAnimationFrame(n):he=window.setTimeout(n,80)},Pe=()=>{let e=K();fe.forEach(t=>{t.disabled=!e}),pe.forEach(t=>{t.disabled=!e||S.checked});let t=G();ie.disabled=!t,se.disabled=!t,ce.disabled=!t,le.disabled=!t,e?(h.textContent=`Image selected`,q(S.checked?`Fast WebGL preview is on. Tone, clarity, dynamic range, and levels are live approximations.`:`Move sliders to update the selected image.`)):t?(h.textContent=`${t.type} selected`,q(`EPD filters apply to image objects only.`,!0)):(h.textContent=`Nothing selected`,q(`Select an image to use EPD filters.`))},$=()=>{let e=K();if(Pe(),!e)return;let{tone:t,clarity:n,dynamicRange:r,level:i}=X(e);U(_,t.exposure),U(v,t.contrast),U(y,t.saturation),U(b,t.shadows),U(x,t.highlights),w.checked=n.enabled,U(T,n.amount),U(E,n.radius),D.checked=r.enabled,U(O,r.strength),U(k,r.lowPercentile),U(A,r.highPercentile),j.checked=i.enabled,M.checked=i.auto,U(N,i.autoThreshold),U(P,i.lowPercentile),U(F,i.highPercentile)},Fe=()=>{let e=K();if(!e)return;let{tone:t,clarity:n,dynamicRange:r,level:i}=X(e);Object.assign(t,{exposure:H(_),contrast:H(v),saturation:H(y),shadows:H(b),highlights:H(x)}),Object.assign(n,{enabled:w.checked,amount:H(T),radius:H(E),midtone:.5}),Object.assign(r,{enabled:D.checked,strength:H(O),lowPercentile:H(k),highPercentile:H(A)}),Object.assign(i,{enabled:j.checked,auto:M.checked,autoThreshold:H(N),lowPercentile:H(P),highPercentile:H(F)}),Q()},Ie=e=>{let t=R;q(`Loading sample image...`),Re(e).then(e=>{ze(e,{left:120+t*14,top:82+t*10,width:390}),R=(R+1)%o.length}).catch(e=>{q(e instanceof Error?e.message:`Could not load sample image.`,!0)})},Le=e=>{let t=URL.createObjectURL(e);q(`Loading image...`),Re(t).then(e=>{URL.revokeObjectURL(t),ze(e,{left:135,top:95,width:Math.min(420,d.width-120)})}).catch(e=>{URL.revokeObjectURL(t),q(e instanceof Error?e.message:`Could not load image.`,!0)})},Re=e=>new Promise((t,n)=>{let r=new Image;r.crossOrigin=`anonymous`,r.onload=()=>{let e=Math.min(1,s/Math.max(r.naturalWidth,r.naturalHeight)),i=Math.max(1,Math.round(r.naturalWidth*e)),a=Math.max(1,Math.round(r.naturalHeight*e)),o=document.createElement(`canvas`);o.width=i,o.height=a;let c=o.getContext(`2d`);c?(c.imageSmoothingEnabled=!0,c.imageSmoothingQuality=`high`,c.drawImage(r,0,0,i,a),t(o)):n(Error(`Could not create image canvas.`))},r.onerror=()=>n(Error(`Could not load image.`)),r.src=e}),ze=(e,t)=>{let n=new fabric.Image(e,{left:t.left,top:t.top,cornerStyle:`circle`,borderColor:`#18705f`,cornerColor:`#18705f`});n.scaleToWidth(t.width),X(n),n.applyFilters(),L.add(n),L.setActiveObject(n),L.requestRenderAll(),$()},Be=()=>{let e=new fabric.IText(`EPD preview`,{left:90,top:48,fill:`#202124`,fontFamily:`Inter, system-ui, sans-serif`,fontSize:34,fontWeight:760});L.add(e),L.setActiveObject(e),L.requestRenderAll(),$()},Ve=()=>{let e=new fabric.Rect({left:470,top:310,width:130,height:90,fill:`#e8c642`,stroke:`#202124`,strokeWidth:3,rx:2,ry:2});L.add(e),L.setActiveObject(e),L.requestRenderAll(),$()},He=()=>{let e=K();e&&(e.filters=[],X(e),$(),Q(!0))},Ue=e=>{if(g.innerHTML=``,e.length===0){let e=document.createElement(`li`);e.textContent=`No reasons returned.`,g.append(e)}else e.slice(0,6).forEach(e=>{let t=document.createElement(`li`);t.textContent=e,g.append(t)})},We=()=>{let e=K();if(!e)return;let n=e.toCanvasElement(),i=t(n,r,{intent:`natural`}),{tone:a,clarity:o,dynamicRange:s,level:u}=X(e),d=i.adjustmentOptions;if(d.toneMapping&&Object.assign(a,{exposure:d.toneMapping.exposure??0,contrast:d.toneMapping.contrast??0,saturation:d.toneMapping.saturation??0,toneStrength:d.toneMapping.strength??.8,toneMidpoint:d.toneMapping.midpoint??.5,shadows:z((d.toneMapping.shadowBoost??0)/c,-1,1),highlights:z((d.toneMapping.highlightCompress??0)/l,-1,1)}),d.clarity?Object.assign(o,{enabled:!0,amount:d.clarity.amount??0,radius:d.clarity.radius??1.5,midtone:d.clarity.midtone??.5}):o.enabled=!1,d.dynamicRangeCompression){let e=d.dynamicRangeCompression===!0?{mode:`display`,strength:1}:d.dynamicRangeCompression;Object.assign(s,{enabled:!0,mode:e.mode??`display`,strength:e.strength??1,lowPercentile:e.lowPercentile??.02,highPercentile:e.highPercentile??.98,preserveWhite:e.preserveWhite??!0})}else s.enabled=!1;d.levelCompression?Object.assign(u,{enabled:d.levelCompression.mode!==`off`,mode:d.levelCompression.mode??`luma`,auto:d.levelCompression.auto??!0,autoThreshold:d.levelCompression.autoThreshold??.02,lowPercentile:d.levelCompression.percentileClip?.low??.02,highPercentile:d.levelCompression.percentileClip?.high??.98}):u.enabled=!1,$(),Q(!0),Ue(i.reasons),q(`Auto applied: ${i.imageKind}.`)},Ge=e=>{let t=e.getContext(`2d`);t&&(t.clearRect(0,0,e.width,e.height),t.fillStyle=`#ffffff`,t.fillRect(0,0,e.width,e.height))},Ke=(e,t)=>{t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n&&(n.clearRect(0,0,t.width,t.height),n.drawImage(e,0,0))};window.fabric?(Ne(),Me(),Ge(f),Ge(ee),Se(),(()=>{L=new fabric.Canvas(d,{backgroundColor:`#ffffff`,preserveObjectStacking:!0,selectionColor:`rgba(24, 112, 95, 0.16)`,selectionBorderColor:`#18705f`,selectionLineWidth:1}),L.setDimensions({width:d.width,height:d.height});let e=new fabric.Text(`Click objects, tune image filters`,{left:38,top:28,fontSize:22,fontFamily:`Inter, system-ui, sans-serif`,fontWeight:700,fill:`#2f3437`,selectable:!1,evented:!1});L.add(e),Ve(),Be(),Ie(o[0])})(),I.forEach(({input:e})=>{e.addEventListener(`input`,()=>{W(e),Fe()})}),[S,C,w,D,j,M].forEach(e=>{e.addEventListener(`change`,()=>{e===S?(Z(),Pe(),q(S.checked?`Fast WebGL preview is on. Tone, clarity, dynamic range, and levels are live approximations.`:`Exact CPU filters are active in the editor.`)):e===C?q(C.checked?`Debounce disabled. Slider edits apply immediately.`:`Debounce enabled. CPU slider edits wait 80 ms before applying.`):Fe()})}),p.addEventListener(`change`,()=>{let e=p.files?.[0];e&&(Le(e),p.value=``)}),te.addEventListener(`click`,()=>{Ie(o[R])}),ne.addEventListener(`click`,Be),re.addEventListener(`click`,Ve),ie.addEventListener(`click`,()=>{let e=G();e&&(L.remove(e),L.discardActiveObject(),L.requestRenderAll(),$())}),se.addEventListener(`click`,()=>{let e=G();e&&(e.bringForward(),L.requestRenderAll())}),ce.addEventListener(`click`,()=>{let e=G();e&&(e.sendBackwards(),L.requestRenderAll())}),le.addEventListener(`click`,()=>{let e=G();e&&(e.center(),e.setCoords(),L.requestRenderAll())}),oe.addEventListener(`click`,He),ae.addEventListener(`click`,We),m.addEventListener(`click`,async()=>{let t=++me;J(`Rendering...`),m.disabled=!0;let i=S.checked;try{i&&(S.checked=!1,Z(),await new Promise(e=>requestAnimationFrame(e)));let o=L.toCanvasElement(1),s=n(o,r,{intent:`natural`});if(await e(o,f,{...s.ditherOptions,palette:r}),t!==me)return;a(f,ee,r),Ue(s.reasons),J(`Rendered as ${s.imageKind}.`)}catch(e){J(e instanceof Error?e.message:`Could not render preview.`,!0)}finally{i&&(S.checked=!0,Z()),m.disabled=!1}}),L.on(`selection:created`,$),L.on(`selection:updated`,$),L.on(`selection:cleared`,$),Ke(d,f),Ke(d,ee)):(q(`Fabric.js did not load. Check the CDN script.`,!0),h.textContent=`Fabric unavailable`);