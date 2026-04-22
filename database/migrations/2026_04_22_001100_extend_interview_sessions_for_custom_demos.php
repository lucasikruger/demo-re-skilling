<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->string('flow_mode')->default('default')->after('participant_name');
            $table->string('internal_session_code')->nullable()->after('flow_mode');
            $table->foreignId('custom_demo_template_id')->nullable()->after('internal_session_code')->constrained()->nullOnDelete();
            $table->timestamp('interrupted_at')->nullable()->after('completed_at');
        });
    }

    public function down(): void
    {
        Schema::table('interview_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('custom_demo_template_id');
            $table->dropColumn(['flow_mode', 'internal_session_code', 'interrupted_at']);
        });
    }
};
