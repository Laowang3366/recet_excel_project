ALTER TABLE `question_excel_template`
    ADD COLUMN `ideal_answer_image_url` VARCHAR(512) DEFAULT NULL COMMENT '理想答案参考图地址' AFTER `template_file_url`;
