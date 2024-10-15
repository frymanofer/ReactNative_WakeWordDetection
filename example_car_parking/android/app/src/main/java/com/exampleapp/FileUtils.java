package com.exampleapp.utils;

import android.os.Environment;
import java.io.File;
import java.io.FileNotFoundException;

public class FileUtils {

    public static String findFilePath(String fileName) throws FileNotFoundException {
        File externalStorageDir = Environment.getExternalStorageDirectory();
        searchFileRecursively(externalStorageDir, fileName);
        String filePath = searchFileRecursively(externalStorageDir, fileName);

        if (filePath == null) {
            fileName = "car-li-po_en.ppn";
            searchFileRecursively(externalStorageDir, fileName);
            filePath = searchFileRecursively(externalStorageDir, fileName);
            if (filePath == null) {
                throw new FileNotFoundException("File not found: " + fileName);
            }
        }

        return filePath;

    }

    private static String searchFileRecursively(File dir, String fileName) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    String result = searchFileRecursively(file, fileName);
                    if (result != null) {
                        return result;
                    }
                } else if (fileName.equals(file.getName())) {
                    return file.getAbsolutePath();
                }
            }
        }
        return null;
    }
}
