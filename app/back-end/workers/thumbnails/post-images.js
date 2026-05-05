const { parentPort, workerData } = require("worker_threads");
const Image = require("./../../image.js");
const normalizePath = require("normalize-path");
const sizeOf = require("image-size");

process.send = (data) => parentPort.postMessage(data);

let appInstance = workerData.appInstance;
let imageData = workerData.imageData;
let image = new Image(appInstance, imageData);
let result = image.save(false);

parentPort.on("message", function (msg) {
  if (msg.type == "start-regenerating") {
    if (!result || !result.newPath) {
      // When process is ready - finish it by sending a proper event
      process.send({
        type: "finished",
        result: result,
      });

      setTimeout(function () {
        process.exit();
      }, 1000);

      return;
    }

    if (!imageData.imageType) {
      imageData.imageType = "contentImages";
    }

    let promises = image.createResponsiveImages(
      result.newPath,
      imageData.imageType
    );

    if (!promises.length) {
      setTimeout(() => {
        let thumbnailDimensions = false;

        try {
          thumbnailDimensions = sizeOf(result.newPath);
        } catch (e) {
          thumbnailDimensions = false;
        }

        process.send({
          type: "finished",
          result: {
            baseImage: result,
            thumbnailPath: result.url,
            thumbnailDimensions: thumbnailDimensions,
          },
        });
      }, 250);

      setTimeout(function () {
        process.exit();
      }, 1000);

      return;
    }

    Promise.all(promises)
      .then((res) => {
        setTimeout(() => {
          let thumbnailDimensions = false;

          try {
            thumbnailDimensions = sizeOf(res[0]);
          } catch (e) {
            thumbnailDimensions = false;
          }

          // When process is ready - finish it by sending a proper event
          process.send({
            type: "finished",
            result: {
              baseImage: result,
              thumbnailPath: res.map((url) => "file:///" + normalizePath(url)),
              thumbnailDimensions: thumbnailDimensions,
            },
          });
        }, 250);

        setTimeout(function () {
          process.exit();
        }, 1000);
      })
      .catch((err) => console.log(err));
  }
});
