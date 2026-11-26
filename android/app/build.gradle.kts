plugins { id("com.android.application") }

android {
    namespace = "com.speechtotext.keyboard"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.speechtotext.keyboard"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "0.2.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes { release { isMinifyEnabled = false } }
    testOptions { unitTests.isIncludeAndroidResources = true }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:5.3.0")
    implementation("androidx.emoji2:emoji2-emojipicker:1.6.0")
    implementation("androidx.autofill:autofill:1.1.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.robolectric:robolectric:4.17")
}
